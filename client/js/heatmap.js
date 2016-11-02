/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/7/16.
 */

class HeatMap {    
    constructor(parent, data, labels, pos_x, pos_y, options) {
        `data is a matrix of values,
        labels is an optional matrix of ids`
        
        // Default draw options.
        this.options = {
            id: _.uniqueId('heatmap_'),
            opacity: [],
            showSetup: false,
            datatype: 'scalar',
            title: "heatmap",
            cellWidth: 10,
            cellHeight: 15,
            colorScale: d3.scale.linear(),
        };
        this.updateOptions(options);
        
        this.layout = {
            mapping_panel: {x: 0, y: -20 - 20},
            title: {x: 0, y: -20 + 12},
            main: {x: 0, y: 0}
        };

        // The heatmap itself.
        this.parent = parent;
        this.hm = gr(d3.select(parent), 'heatmap', {x:pos_x, y:pos_y})

        // Little Title above.
        this.hm.append('text').attr({
            "class": 'hm-title',
            x: this.layout.title.x,
            y: this.layout.title.y
        }).text(this.options.title);

        // The heat map itself.
        this.drawPanel();

        // Tool tips
        this.init_tooltip();
        this.updateData(data, labels, {})
    }

    updateOptions(options) {
        Object.keys(options || {}).map(d => this.options[d] = options[d]);
    }

    updateData(data, labels, options) {
        this.updateOptions(options);        

        // Set the color scale.
        if (this.options.noAutoColorScale == undefined) {
            this.max = this.options.max || _.max(_.flatten(data));
            this.min = this.options.min || _.min(_.flatten(data));
            if (this.min < 0) {
                var maxAbs = -this.min > this.max ? -this.min : this.max;
                this.options.colorScale = d3.scale.linear()
                    .domain([maxAbs, 0, maxAbs])
                    .range(['#ca0020', '#f7f7f7', '#0571b0']);
            } else {
                this.options.colorScale = d3.scale.linear()
                    .domain([this.min, this.max])
                    .range(['#f7f7f7', '#0571b0'])
            }
        }

        // Make the data.
        var labelFormat = d3.format(".4f");
        if (!_.isNumber(data[0][0])) labelFormat = _.identity;
        var label = (x, y, v) => { return {x:x, y:y, label: labels[x][y], value:v};};
        if (!labels)
            label = (x, y, v) => { return {x:x, y:y, label: labelFormat(v), value:v};};
        this.data = _.flatten(data.map((row, x) => row.map((value, y) => label(x,y,value))));
    }


    draw(options) {
        this.updateOptions(options)
        
        // Create a heat map cell
        var hmCell = this.hmCells.selectAll(".hmCell").data(this.data);
        hmCell.exit().remove();
        hmCell.enter().append("rect");
        
        var has_opacity = this.options.opacity.length > 0 && this.options.datatype != 'scalar';
        hmCell.attr({
            "class": d => "hmCell x" + d.x + " y" + d.y,
            x: d => d.y * this.options.cellWidth,
            y: d => d.x * this.options.cellHeight,
            width: this.options.cellWidth,
            height: this.options.cellHeight
        });
        
        var style_hm = hmCell;
        if (options && options.transition == true) 
            style_hm = hmCell.transition().duration(1000);
        
        style_hm.style({
            fill: d => this.options.colorScale(d.value),
            opacity: d => (has_opacity) ? this.options.opacity[d.x][d.y] : null
        });

        hmCell.on({
            'mouseover': d => 
                this.eventHandler.trigger('heatmap_item_hovered',
                                          {x: d.x, y: d.y, active: true}),
            'mouseout': d => 
                this.eventHandler.trigger('heatmap_item_hovered',
                                          {x: d.x, y: d.y, active: false})
        });
        // End
    }
    
    hoverCell(x, y, select) {
        var hovered = this.hm.selectAll(".x" + x + ".y" + y);
        hovered.classed('hovered', select);
        
        if (select) {
            var datum = hovered.datum();
            this.tooltip.attr({
                opacity: 1,
                "transform": tr({x: datum.y * this.options.cellWidth,
                                 y: (datum.x + 1) * this.options.cellHeight + 5 + this.layout.main.y})
            });
            this.tooltip.select('text').text(datum.label);
        } else {
            this.tooltip.attr({opacity: 0});
        }
    }

    drawPanel() {
        var that = this;
        this.mapping_panel = gr(this.hm, 'mapping_panel', this.layout.mapping_panel);
        this.mapping_panel.append('rect').attr({
            class: 'mapping-rect',
            x: 0,
            y: 3,
            width: 15,
            height: 10
        }).on({
            'click': function () {
                that.eventHandler.trigger('heatmap_mapping_rect_selected',
                                          d3.select(this).classed('selected') ? 'none' : that.id);
            }
        });
        
        this.mapping_panel.append('rect').attr({
            class: 'mapping-circle',
            x: 20,
            y: 3,
            width: 15,
            height: 10
        }).on({
            'click': function () {
                that.eventHandler.trigger('heatmap_mapping_circle_selected',
                                          d3.select(this).classed('selected') ? 'none': that.id)
            }
        });
        
        this.mapping_panel.append('circle').attr({
            cx: 20 + 3,
            cy: 3 + 5,
            r: 2
        });
        
        if (this.options.showSetup) 
            this.mapping_panel.append('text').attr({
                class: 'setup-icon',
                x: 40,
                y: 3 + 10
            }).on({
                'click': function () {
                    that.eventHandler.trigger('hm_setup', that.id);
                }
            }).text("\uf085");

    }

    init_tooltip() {
        this.hmCells = gr(this.hm, 'cells', this.layout.main);        
        this.tooltip = gr(this.hm, 'hm-tooltip', {x:5, y:50}).attr("opacity", 0);
        this.tooltip.append('rect').attr({
            x: -50,
            y: 0,
            width: 100,
            height: 15
        });
        this.tooltip.append('text').attr({
            x: 0,
            y: 13
        }).text('Hallo')
    }

    bindEvents(handler) {
        this.eventHandler = handler;
        handler.bind('draw', this.draw());
        handler.bind('heatmap_item_hovered', (e, data) =>
            this.hoverCell(data.x, data.y, data.active));
        
        handler.bind('heatmap_mapping_rect_selected', (e, hm_id) =>
            this.hm.selectAll('.mapping-rect').classed('selected', this.options.id == hm_id));
        
        handler.bind('heatmap_mapping_circle_selected', (e, hm_id) =>
            this.hm.selectAll('.mapping-circle').classed('selected', this.options.id == hm_id));
        
        handler.bind('row_detail', (e, id) =>
                     this.hm.transition().style({
                         opacity: (id > -1) ? 0 : 1,
                         'pointer-events': (id > -1) ? 'none': null}));
    }
}
