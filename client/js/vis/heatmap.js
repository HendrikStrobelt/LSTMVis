

/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */


class HeatMapComponent extends VComponent {

    static get events() {
        return {
            itemHovered: 'HeatMap_itemHovered',
            rectSelected: 'HeatMap_rectSelected',
            circleSelected: 'HeatMap_circleSelected',
        }
    }

    _getDefaultOptions() {
        return {
            pos: {x: 30, y: 50},
            opacity: [],
            datatype: 'scalar',
            title: "heatmap",
            cellWidth: 10,
            cellHeight: 15,
            colorScale: d3.scaleLinear(),
            mapping_panel: {x: 0, y: -20 - 20},
            titlePos: {x: 0, y: -20 + 12},
            mainPos: {x: 0, y: 0}
        }
    }

    // Data Style
    // {{}, {}} 

    // INIT METHODS
    _init() {
        this.hm = SVG.group(this.parent, 'heatmap', this.options.pos);

        // Put title above.
        this.hm.append('text').attrs({
            "class": 'hm-title',
            x: this.options.titlePos.x,
            y: this.options.titlePos.y
        }).text(this.options.title);
        this._initPanel()
        this._initTooltip();
    }

    _initPanel() {
        var that = this;
        this.mapping_panel = SVG.group(this.hm, 'mapping_panel', this.options.mapping_panel);
        this.mapping_panel.append('rect').attrs({
            class: 'mapping-rect',
            x: 0,
            y: 3,
            width: 15,
            height: 10
        }).on({
            'click': function () {
                that.eventHandler.trigger(that.event.rectSelected,
                                          d3.select(this).classed('selected') ? 'none' : that.id);
            }
        });
        
        this.mapping_panel.append('rect').attrs({
            class: 'mapping-circle',
            x: 20,
            y: 3,
            width: 15,
            height: 10
        }).on({
            'click': function () {
                that.eventHandler.trigger(that.event.circleSelected,
                                          d3.select(this).classed('selected') ? 'none': that.id)
            }
        });
        
        this.mapping_panel.append('circle').attrs({
            cx: 20 + 3,
            cy: 3 + 5,
            r: 2
        });
    }

    _initTooltip() {
        this.hmCells = SVG.group(this.hm, 'cells', this.options.mainPos);        
        this.tooltip = SVG.group(this.hm, 'hm-tooltip', {x:5, y:50}).attr("opacity", 0);
        this.tooltip.append('rect').attr({
            x: -50,
            y: 0,
            width: 100,
            height: 15
        });
        this.tooltip.append('text').attrs({
            x: 0,
            y: 13
        }).text('Hallo')
    }

    // RENDER/WRANGLE METHODS
    _wrangle(data) {
        if (this.options.noAutoColorScale == undefined) {
            this.max = this.options.max || _.max(_.flatten(data));
            this.min = this.options.min || _.min(_.flatten(data));
            if (this.min < 0) {
                var maxAbs = -this.min > this.max ? -this.min : this.max;
                this.options.colorScale = d3.scaleLinear()
                    .domain([maxAbs, 0, maxAbs])
                    .range(['#ca0020', '#f7f7f7', '#0571b0']);
            } else {
                this.options.colorScale = d3.scaleLinear()
                    .domain([this.min, this.max])
                    .range(['#f7f7f7', '#0571b0'])
            }
        }

        // Make the data.
        var labelFormat = d3.format(".4f");
        if (!_.isNumber(data[0][0])) labelFormat = _.identity;
        // var label = (x, y, v) => { return {x:x, y:y, label: labels[x][y], value:v};};
        // if (!labels) {
        let label = (x, y, v) => { return {x: x, y: y, label: labelFormat(v), value: v};};
        // }

        // Return the renderData.
        return  _.flatten(data.map((row, x) => row.map((value, y) => label(x, y, value))));
    }

    _render(renderData) {
        // Create a heat map cell
        var hmCell = this.hmCells.selectAll(".hmCell").data(renderData);
        hmCell.exit().remove();
        hmCell.enter().append("rect");
        
        var has_opacity = this.options.opacity.length > 0 && this.options.datatype != 'scalar';

        // This should be a linear scale.
        hmCell.attrs({
            "class": d => "hmCell x" + d.x + " y" + d.y,
            x: d => d.y * this.options.cellWidth,
            y: d => d.x * this.options.cellHeight,
            width: this.options.cellWidth,
            height: this.options.cellHeight
        });
        
        var style_hm = hmCell;
        if (this.options.transition == true) {
            style_hm = hmCell.transition().duration(1000);
        } 

        style_hm.styles({
            fill: d => this.options.colorScale(d.value),
            opacity: d => (has_opacity) ? this.options.opacity[d.x][d.y] : null
        });

        hmCell
            .on('mouseover', d => 
                this.eventHandler.trigger(this.events.itemHovered,
                                          {x: d.x, y: d.y, active: true}))
            .on('mouseout', d => 
                this.eventHandler.trigger(this.events.itemHovered,
                                          {x: d.x, y: d.y, active: false}));
    }

    // ACTION METHODS
    actionHoverCell(x, y, select) {
        var hovered = this.hm.selectAll(".x" + x + ".y" + y);
        hovered.classed('hovered', select);
        
        if (select) {
            var datum = hovered.datum();
            this.tooltip.attrs({
                opacity: 1,
                "transform": tr({x: datum.y * this.options.cellWidth,
                                 y: (datum.x + 1) * this.options.cellHeight + 5 + this.layout.mainPos.y})
            });
            this.tooltip.select('text').text(datum.label);
        } else {
            this.tooltip.attr({opacity: 0});
        }
    }


    bindEvents(handler) {
        this.eventHandler = handler;
        // handler.bind('draw', this.draw());
        handler.bind(this.event.itemHovered, (e, data) =>
            this.actionHoverCell(data.x, data.y, data.active));
        
        handler.bind(this.event.rectSelected, (e, hm_id) =>
            this.hm.selectAll('.mapping-rect').classed('selected', this.id == hm_id));
        
        handler.bind(this.event.circleSelected, (e, hm_id) =>
            this.hm.selectAll('.mapping-circle').classed('selected', this.id == hm_id));
        
        // handler.bind('row_detail', (e, id) =>
        //              this.hm.transition().style({
        //                  opacity: (id > -1) ? 0 : 1,
        //                  'pointer-events': (id > -1) ? 'none': null}));
    }
}

HeatMapComponent;
