/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 6/4/16.
 */

var tr = (point) => "translate(" + point.x + "," + point.y + ")";
var gr = (base, classes, pos) => base.append('g').attr({
    class: classes,
    "transform": tr(pos)});


class PCPlot {
    constructor(parent, x, y, data, options) {
        `Draw a PC plot under parent with positioned at (x, y).`
        
        // Default data.
        this.data = {
            draw_data: [],
            threshold: 0,
            selected_cells: [],
            excluded_cells: [],
            active_brush_selection: false,
            brush: []
        };

        // Default draw options.
        this.options = {
            xScale: d3.scale.linear(),
            yScale: d3.scale.linear(),
            word_brush_scale: d3.scale.linear(),
            hover_event_name: 'none',
            pc_id: 0
        };

        // Constants
        this.layout = {
            threshold_slider: {
                x: 20, y: 0, w: 10
            },
            pc: {
                x: 20, y: 0
            }
        }
        this.update(data, options);
        
        //  Create static groups.
        this.parent = d3.select(parent);

        // Groups
        this.content_group = gr(this.parent, PCPlot.constructor.name, {x, y})
        this.pc_group = gr(this.content_group, 'PC_plot', this.layout.pc)
        this.pc_group_overlay = gr(this.content_group, 'PC_plot_overlay',
                                   this.layout.pc)
        this.threshold_slider_group = gr(this.content_group,
                                         'threshold_slider_group slider_group',
                                         this.layout.threshold_slider)

        this.create_threshold_slider();
    }

    update(data, options) {
        // Update a subset of keys.
        Object.keys(data).map(d => this.data[d] = data[d]);
        Object.keys(options).map(d => this.options[d] = options[d]);
    }

    redraw() {
        var op = this.options;
        var dt = this.data;

        var line_opacity = 1. / (Math.sqrt(dt.draw_data.length) + .00001);
        var line = d3.svg.line()
            .x((d, i) => op.xScale(i))
            .y(d => op.yScale(d));

        this.pc_group.style("opacity", dt.active_brush_selection ? 1 : .7)        

        // Draw non-selected cells (grey cells)
        var pc_line = this.pc_group.selectAll(".pc_line")
            .data(dt.draw_data.filter(
                d => !_.includes(dt.selected_cells, d.index)));
        
        pc_line.exit().remove();
      
        pc_line.enter().append("path");
        
        pc_line.attr({
            "class": d => "pc_line cell_" + d.index,
            d: d => line(d.values)
        }).style({
            opacity: line_opacity
        });
        // End 
        
        // Draw selected cells (Green cells)
        var pc_line_overlay = this.pc_group_overlay.selectAll(".pc_line_overlay")
            .data(dt.draw_data.filter( d =>
                 _.includes(dt.selected_cells, d.index)
            ));
        pc_line_overlay.exit().remove();
        
        pc_line_overlay.enter().append("path");
        
        pc_line_overlay
            .attr({"d" : d => line(d.values),
                   "class": d => "cell_" + d.index
                  })
            .classed("deselected", d => _.includes(dt.excluded_cells, d.index))
            .classed("pc_line_overlay", true)
            .on({'mouseenter': d => 
                 this.event_handler.trigger(op.hover_event_name, {cell: d.index, active: true}),
                 'mouseout': d =>
                 this.event_handler.trigger(op.hover_event_name, {cell: d.index, active: false})
                });
        // End

        // Draw threshold line (Red dotted line)
        var threshold_line = this.pc_group_overlay.selectAll(".threshold_line").data([dt.threshold]);
        
        threshold_line.exit().remove();
        
        threshold_line.enter().append("line").attr({
            "class": "threshold_line"
        });
        
        threshold_line.attr({
            x1: op.xScale(0),
            x2: op.xScale.range()[1],
            y1: (d) =>  op.yScale(d),
            y2: (d) => op.yScale(d)
        });
        //End
        
        // Draw brush indicator (Green dotted lines)
        var b_data = ((dt.brush.length>0 && dt.brush[0]!=dt.brush[1])?dt.brush:[]);
        var brush_indicator = this.pc_group_overlay.selectAll(".brush_indicator").data(b_data);

        brush_indicator.exit().remove();
        
        brush_indicator.enter().append("line")
            .classed("brush_indicator", true);
        
        brush_indicator.attr({
            x1: (d) => op.word_brush_scale(d),
            x2: (d) => op.word_brush_scale(d),
            y1: (d) => op.yScale.range()[0],
            y2: (d) => op.yScale.range()[1]
        });
        // End
    }
    
    create_threshold_slider() {
        var op = this.options;
        var dt = this.data;

        // Set up for the (red) dashed slider
        var brushScale = d3.scale.linear()
            .domain(op.yScale.domain())
            .range(op.yScale.range()).clamp(true);
        
        var brush = d3.svg.brush()
            .y(brushScale)
            .extent([dt.threshold, dt.threshold])
            .on('brush', brushed);
        
        var slider = this.threshold_slider_group.call(brush);
        slider.select(".background")
            .attr("width", this.layout.threshold_slider.w);
        
        var yAxis = d3.svg.axis().scale(brushScale).orient('left');
        slider.append('g').attr({
            class: 'axis',
            "transform": tr({x: this.layout.threshold_slider.w / 2, y:0})
        }).style('pointer-events', 'none').call(yAxis);
        
        var handle = slider.append('circle').attr({
            class: 'handle',
            "transform": tr({x: this.layout.threshold_slider.w / 2, y:0}),
            "r": 5,
            "cy": brushScale(dt.threshold)
        });
        
        var number_format = d3.format('.3f');
        this.value_text = slider.append('text')
            .attr({y: -3}).style({'text-achor': 'middle'})
            .text(number_format(dt.threshold));

        var that = this;
        
        // Called when threshold is changed.
        function brushed() {
            var value = brush.extent()[0];
            var e = d3.event;
            if (e.sourceEvent) { 
                value = brushScale.invert(d3.mouse(this)[1]);
                brush.extent([value, value]);
            }
            
            handle.attr("cy", brushScale(value));
            that.value_text.text(number_format(value));
            that.event_handler.trigger(Event_list.threshold_update,
                                       {value: value,
                                        pc_id: op.pc_id});
        }
    }

    bind_event_handler(event_handler) {
        // Throws events
        // Event_list.threshold_update
        // this.options.hover_event_name
        this.event_handler = event_handler;
        this.event_handler.bind('redraw', () => this.redraw())        
    }

    destroy() {
        this.content_group.remove();
    }
}
    
