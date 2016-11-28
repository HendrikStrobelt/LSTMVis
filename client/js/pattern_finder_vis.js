/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/29/16.
 */

const CELL_COUNT_HM_ID = 'cell_count';
const LEFT_CONTEXT = 5;
const RIGHT_CONTEXT = 50;

class PatternFinderVis{

    constructor(parent, x, y, event_handler, options) {
        this.parent = d3.select(parent);
        this.options = options;
        
        var source_split = options.source.split('::');
        this.source_info = _.find(globalInfo.info.states.types, {file: source_split[0], path: source_split[1]});        
        
        // == geometry ==
        this.layout = {
            pc: {
                x: 0, y: 20, h: 200
            },
            mini_preview: {
                x: 20, y: 255, w: 1200, h: 30
            },
            mini_range_preview: {
                x: 20, y: 290, w: 1200, h: 100
            },
            cell_selectors: {
                x: 20, y: 390, cw: 30, h: 15
            },
            result_view: {
                x: 20, y: 420
            },
            cell_width: 35,
            low_pass_button: {
                x: 100, y: 3, w: 150, h: 15
            },
            clear_sel_button: {
                x: 550, y: 3, w: 150, h: 15
            },
            low_pass_slider: {
                x: 280, y: 3, w: 150, h: 15
            },
            navigation_buttons: {
                x: 500, y: 15
            }
            
        };
        
        //noinspection JSUnresolvedVariable
        this.yScale = d3.scale.linear().domain([this.source_info.unsigned ? 0 : -1, 1]).range([this.layout.pc.h - 6, 3]);
        this.xScale = d3.scale.linear();
        this.brushScale = d3.scale.linear();
        
        this.content_group = this.parent.append("g").attr({
            class: 'PatternFinderVis',
            "transform": "translate(" + x + "," + y + ")"
        });
        
        
        //=== client-side cell selection ===
        this.selected_cells_for_query = []; // query: these cells NAND current.selection.excluded_cells are excluded !!!
        
        // == state variables to load and save ==
        this.current = {
            pos: 1000,
            data_set: 0,
            source: null,
            brush_extent: [0, 0],
            zero_left: 1,
            zero_right: 0,
            selection: {
                threshold: .3,
                low_pass_threshold: 0,
                cells: null,
                excluded_cells: [],
                phrase_length: null
            },
            heatmap: {
                rect_selection: 'none',
                circle_selection: 'none',
                map_cell_count_opacity: false
            }
        };
        
        
        this.sync_options_and_states(true);
        
        
        // == helper ===
        this.text_length_tester = this.content_group.append('text').attr({
            class: 'word',
            x: 0,
            y: 0,
            opacity: 0
        });
        
        
        // === start ===
        this.init_groups();
        this.init_gui();
        this.draw_low_pass_slider();
        
        this.pc_plots = [];
        this.result_view = new ResultView(
            this.content_group.node(),
            this.layout.result_view.x,
            this.layout.result_view.y,
            {
                threshold: this.current.selection.threshold,
                selected_cells: this.selected_cells_for_query,
                excluded_cells: this.current.selection.excluded_cells
            }, {
                text_length_tester: this.text_length_tester,
                data_set: options.data_set,
                source: options.source,
                source_info: this.source_info,
                url: url,
                zero_left: this.current.zero_left,
                zero_right: this.current.zero_right
            });
        this.result_view.bind_event_handler(event_handler);
        
        this.bindEvents(event_handler);

        this.query_context(this.current.pos, this.current.data_set, this.current.source, this.current.selection.low_pass_threshold);
        
    }

    /**
     * update options from states or vice versa
     * @param update_states - true if options -> states; false if states -> options
     */
    sync_options_and_states(update_states) {
        var that = this;
        var current = that.current;
        var options = that.options;
        
        if (update_states) {
            current.pos = options.pos || current.pos;
            current.data_set = options.data_set || current.data_set;
            current.selection.low_pass_threshold = +options.low_pass || current.selection.low_pass_threshold;
            current.selection.threshold = +options.threshold || current.selection.threshold;
            current.source = options.source || current.source;

            var brush_string = options.brush;
            if (brush_string && brush_string.length > 0) {
                current.brush_extent = brush_string.split(',').map(d =>  +d);
            }

            var zero_padding = options.padding;
            if (zero_padding && zero_padding.length > 0) {
                var tmp = zero_padding.split(',').map(d => +d);
                current.zero_left = tmp[0];
                current.zero_right = tmp[1];
            }


            var cell_string = options.cells;
            if (cell_string && cell_string.length > 0) {
                current.selection.cells = cell_string.split(',').map(d => +d);

            }

            var ex_cell_string = options.ex_cell;
            if (ex_cell_string && ex_cell_string.length > 0) {
                that.current.selection.excluded_cells = ex_cell_string.split(',').map(d => +d)
            }


        } else {
            // TODO: maybe
        }

    }

    /**
     * updates the cell selection
     * @returns {boolean}
     */
    update_cell_selection() {
        var left = this.current.brush_extent[0];
        var right = this.current.brush_extent[1];
        var zero_left = this.current.zero_left;
        var zero_right = this.current.zero_right;

        this.discretize_data();
        if (left != right) {
            var length_pattern = right - left + zero_left + zero_right;
            var sel_cells_slice = _.range(left - zero_left, right + zero_right).map(
                (time_step, i) => {
                    if (i < zero_left || i > length_pattern - 1 - zero_right) return this.cell_active_per_timestep[time_step][0];
                    else return this.cell_active_per_timestep[time_step][1];
                }
            );
            this.selected_cells_for_query = _.intersection.apply(this, sel_cells_slice);
            return true;
        } else {
            this.selected_cells_for_query = [];
            return true; // TODO: used to be false .. but not necessary anymore
        }
    }

    discretize_data() {
        var threshold = this.current.selection.threshold;
        this.cell_active_per_timestep = this.data.states[0].data[0].map(() => [[], []]);
        this.discrete_states = this.data.states[0].data.map((cell, cell_index) => {
            return cell.map((value, time_step) => {
                if (value < threshold) {
                    // off
                    this.cell_active_per_timestep[time_step][0].push(cell_index);
                    return 0;
                } else {
                    // on
                    this.cell_active_per_timestep[time_step][1].push(cell_index);
                    return 1;
                }
            })
        });
    }

    reset_cell_selections(reset_pre_selected, reset_excluded) {
        reset_pre_selected = reset_pre_selected || true;
        reset_excluded = reset_excluded || true;

        if (reset_pre_selected) {
            this.current.selection.cells = null;
            this.eventHandler.trigger('replace_url', {cells: null})
        }

        if (reset_excluded) {
            this.current.selection.excluded_cells = [];
            this.eventHandler.trigger('replace_url', {ex_cell: null})
        }
    };

    bindEvents(eventHandler) {
        var that = this;

        this.eventHandler = eventHandler;

        eventHandler.bind('new_pivot_context', (e, d) => {
            that.current.pos = d.data.index;

            that.reset_cell_selections();

            that.query_context(that.current.pos, that.current.data_set, that.current.source);


            that.eventHandler.trigger('replace_url', {pos: that.current.pos});
        });

        eventHandler.bind('navigate', (e, d) => {
            that.current.pos = that.current.pos + d;

            that.current.brush_extent = that.current.brush_extent.mp(b => b - d);
                                                                     
            that.current.selection.cells = that.selected_cells_for_query;


            that.query_context(that.current.pos, that.current.data_set, that.current.source, that.current.selection.low_pass_threshold);

            that.eventHandler.trigger('replace_url', {
                pos: that.current.pos,
                brush: that.current.brush_extent.join(','),
                cells: that.selected_cells_for_query.join(','),
                ex_cells: that.current.selection.excluded_cells.join(',')
            });

        });


        eventHandler.bind('low_pass_filter', function () {
            var closestQuery = url + "/api/rle_states/"
                + that.current.pos
                + '?left=' + LEFT_CONTEXT + '&right=' + RIGHT_CONTEXT + '&threshold=' + that.current.selection.threshold
                + '&rle=' + that.current.selection.low_pass_threshold
                + '&data_set=' + (that.current.data_set)
                + '&data_transform=' + (that.source_info.transform);

            if (that.current.source) {
                closestQuery += '&source=' + that.current.source
            }

            that.reset_cell_selections();


            $.ajax(closestQuery, {
                dataType: 'json',
                success: function (data) {
                    that.data.states[0] = data[0][0];

                    var cell_id_mapper = _.identity;
                    if (that.data.cells.length > 0) {
                        cell_id_mapper =  d => that.data.cells[d];
                    }


                    that.data.draw_data = that.data.states[0].data.map((d, i) => {
                        return {index: cell_id_mapper(i), values: d};
                    }).filter(d =>_.sum(d.values) != 0);

                    that.update_cell_selection();
                    that.redraw();
                    that.eventHandler.trigger('replace_url', {low_pass: that.current.selection.low_pass_threshold});
                }
            })


        });

        // gui event

        eventHandler.bind('brush_extent', function (e, d) {

            that.label_group.select(".brushArea").call(that.word_brush.extent(d.value));

            // console.log(d.value,'\n-- d.value --');
            // performance shortcut
            if (_.isEqual(that.current.brush_extent, d.value)) return;

            that.reset_cell_selections();
            that.current.selection.cells = null; // no pre-defined cells

            that.current.brush_extent = d.value;
            if (that.update_cell_selection()) {
                that.redraw();
            }

            var brushArea = that.zero_slider_group.select(".brushArea");

            if (that.current.brush_extent[0] == that.current.brush_extent[1]) {
                brushArea.call(that.zero_brush.extent([0, 0]));

            } else {
                brushArea.call(that.zero_brush.extent(
                    [that.current.brush_extent[0] - that.current.zero_left,
                     that.current.brush_extent[1] + that.current.zero_right]));
            }


            that.zero_slider_ov_rect.attr({
                x:  () =>  that.brushScale(that.current.brush_extent[0]),
                width: () => that.brushScale(that.current.brush_extent[1]) - that.brushScale(that.current.brush_extent[0])
            });


            that.eventHandler.trigger('replace_url', {brush: that.current.brush_extent.join(',')});
        });


        eventHandler.bind('zero_padding_changed', function (e, d) {
            that.current.zero_left = d.left;
            that.current.zero_right = d.right;

            that.reset_cell_selections();

            if (that.update_cell_selection()) {
                that.redraw();
            }


            that.eventHandler.trigger('replace_url', {padding: that.current.zero_left + ',' + that.current.zero_right});

        });


        eventHandler.bind(Event_list.threshold_update, function (e, d) {

            if (d.pc_id == 0) {
                // if primary pc_plot
                that.current.selection.threshold = d.value;
                that.reset_cell_selections();

                if (that.update_cell_selection()) {
                    that.redraw();
                }
            }
            that.eventHandler.trigger('replace_url', {threshold: that.current.selection.threshold});
        });


        /*===============
          Cell events
          ================= */

        eventHandler.bind('cell_clicked', function (e, cell_id) {


            if (_.includes(that.current.selection.excluded_cells, cell_id)) {
                _.remove(that.current.selection.excluded_cells,  d =>  d == cell_id)

            } else {
                that.current.selection.excluded_cells.push(cell_id);
            }

            that.redraw();

            if (that.current.selection.excluded_cells.length > 0) {
                that.eventHandler.trigger('replace_url', {ex_cell: that.current.selection.excluded_cells.join(',')});
            }
            else {
                that.eventHandler.trigger('replace_url', {ex_cell: null});
            }

        });

        eventHandler.bind('cell_hovered', function (e, data) {
            that.content_group.selectAll('.cell_' + data.cell).classed('hover', data.active);
        });
    }

    init_groups() {

        var that = this;

        that.label_group = this.content_group.append('g').attr({
            class: 'labels',
            "transform": "translate(" + (that.layout.pc.x + 20) + "," + (that.layout.pc.y + that.layout.pc.h) + ")"
        });

        that.zero_slider_group = this.content_group.append('g').attr({
            class: 'zero_slider',
            "transform": "translate(" + (that.layout.pc.x + 20) + "," + (that.layout.pc.y + that.layout.pc.h + 16) + ")"
        });

        that.mini_preview = this.content_group.append('g').attr({
            class: 'mini_preview',
            "transform": "translate(" + that.layout.mini_preview.x + "," + that.layout.mini_preview.y + ")"

        });
        that.mini_range_preview = this.content_group.append('g').attr({
            class: 'mini_range_preview',
            "transform": "translate(" + that.layout.mini_range_preview.x + "," + that.layout.mini_range_preview.y + ")"

        });

        that.low_pass_threshold_slider_group = this.content_group.append('g').attr({
            class: 'low_pass_threshold_slider_group slider_group',
            "transform": "translate(" + that.layout.low_pass_slider.x + "," + that.layout.low_pass_slider.y + ")"
        });

        that.cell_selectors_group = this.content_group.append('g').attr({
            "transform": "translate(" + that.layout.cell_selectors.x + "," + that.layout.cell_selectors.y + ")"
        });


    }

    init_gui() {
        var that = this;

        function createButton(parent, x, y, width, height, classes, text, onFunction) {
            var qButtonG = parent.append('g').attr({
                class: classes + ' svg_button',
                "transform": "translate(" + x + "," + y + ")"
            });

            qButtonG.append('rect').attr({
                class: 'bg',
                x: 0,
                y: 0,
                width: width,
                height: height,
                rx: 5,
                ry: 5
            }).on({
                'click': onFunction
            });

            qButtonG.append('text').attr({
                x: Math.floor(width / 2),
                y: Math.floor(height / 2 + 5)
            }).text(text);
        }

        createButton(that.content_group,
                     that.layout.low_pass_button.x, that.layout.low_pass_button.y, //that.layout.query_buttons.cw + 5
                     that.layout.low_pass_button.w, that.layout.low_pass_button.h,
                     'low_pass_filter', 'length filter',
                     () => that.eventHandler.trigger('low_pass_filter')
                    );


        createButton(that.content_group,
                     that.layout.clear_sel_button.x, that.layout.clear_sel_button.y, //that.layout.query_buttons.cw + 5
                     that.layout.clear_sel_button.w, that.layout.clear_sel_button.h,
                     'clear_sel_button', 'clear selection',
                      () => that.eventHandler.trigger('brush_extent', {value: [0, 0]})
                    );

        // navigation buttons
        that.content_group.append('text').attr({
            class: 'navigation_button',
            "transform": "translate(" + that.layout.navigation_buttons.x + "," + (that.layout.navigation_buttons.y) + ")"
        }).text( '\uf190').on({
            click: () => this.eventHandler.trigger('navigate', -5)
        });
        that.content_group.append('text').attr({
            class: 'navigation_button',
            "transform": "translate(" + (that.layout.navigation_buttons.x + 25) + "," + (that.layout.navigation_buttons.y) + ")"
        }).text('\uf18e').on({
            click:  () => this.eventHandler.trigger('navigate', +5)
        })
    }

    draw_low_pass_slider() {
        var that = this;

        var brushScale = d3.scale.linear().domain([0, 20]).range([0, that.layout.low_pass_slider.w]).clamp(true);
        var ex = that.current.selection.low_pass_threshold;//that.yScale(that.threshold);
        var brush = d3.svg.brush()
            .x(brushScale)
            .extent([ex, ex])
            .on('brush', brushed);

        var slider = that.low_pass_threshold_slider_group.call(brush);
        //slider.selectAll('.extent,.resize').remove();
        slider.select(".background")
            .attr("height", that.layout.low_pass_slider.h);

        var yAxis = d3.svg.axis().scale(brushScale).orient('top');
        slider.append('g').attr({
            class: 'axis',
            "transform": "translate(0," + (that.layout.low_pass_slider.h - 1) + ")"
        }).style('pointer-events', 'none').call(yAxis).selectAll("text").remove();

        var handle = slider.append('circle').attr({
            class: 'handle',
            "transform": "translate(0," + that.layout.low_pass_slider.h / 2 + ")",
            "r": 5,
            "cx": brushScale(that.current.selection.low_pass_threshold)
        });

        var number_format = d3.format('1f');

        var value_text = slider.append('text').attr({
            x: -15,
            y: (that.layout.low_pass_slider.h / 2 + 4)
        }).style({
            'text-achor': 'right'
        }).text(number_format(that.current.selection.low_pass_threshold));

        function brushed() {
            var value = brush.extent()[0];

            var e = d3.event;
            if (e.sourceEvent) { // not a programmatic event
                value = Math.round(brushScale.invert(d3.mouse(this)[0]));
                brush.extent([value, value]);
            }

            handle.attr("cx", brushScale(value));
            that.current.selection.low_pass_threshold = value;
            value_text.text(number_format(that.current.selection.low_pass_threshold));

            that.eventHandler.trigger('low_pass_threshold_update');

        }


    }

    draw_word_slider() {
        var that = this;

        that.word_brush = d3.svg.brush()
            .x(that.brushScale)
            .on("brush", brushed);


        var brushArea = that.label_group.selectAll(".brushArea").data([1]);
        brushArea.exit().remove();

        // --- adding Element to class brushArea
        var brushAreaEnter = brushArea.enter().append("g").attr({
            "class": "brushArea brush"
        });

        brushAreaEnter.call(that.word_brush);
        brushAreaEnter.selectAll('rect').attr({
            height: 15
        });


        if (that.current.brush_extent[0] != that.current.brush_extent[1]) {
            brushArea.call(that.word_brush.extent([
                that.current.brush_extent[0],
                that.current.brush_extent[1]
            ]));

            if (!that.current.selection.cells) {
                that.update_cell_selection();
            } else {
                that.selected_cells_for_query = that.current.selection.cells;
            }

        }


        function brushed() {
            var extent0 = that.word_brush.extent(),
                extent1;
            var d0, d1;


            // if dragging, preserve the width of the extent
            if (d3.event.mode === "move") {
                d0 = Math.floor(extent0[0]);
                d1 = Math.round(d0 + extent0[1] - extent0[0]);
                extent1 = [d0, d1];
            }
            //
            //// otherwise, if resizing, round both dates
            else {
                d0 = Math.floor(extent0[0]);
                d1 = Math.ceil(extent0[1]);
                extent1 = [d0, d1];

            }
            //

            that.eventHandler.trigger('brush_extent', {value: extent1})

        }


    }

    draw_zero_slider() {
        var that = this;

        var brush = d3.svg.brush()
            .x(that.brushScale)
            .on("brush", brushed);

        var brushArea = that.zero_slider_group.selectAll(".brushArea").data([1]);
        brushArea.exit().remove();

        // --- adding Element to class brushArea
        var brushAreaEnter = brushArea.enter().append("g").attr({
            "class": "brushArea brush_zero"
        });

        var overlay = that.zero_slider_group.selectAll('.overlayBrushAreaZero').data([1]);
        overlay.enter().append('g').attr({class: 'overlayBrushAreaZero'});


        var ov_rect = overlay.selectAll('rect')
            .data([that.current.brush_extent], d =>  d[0] + '_' + d[1]);
        ov_rect.exit().remove();

        ov_rect.enter().append('rect').attr({
            height: 15
        });


        ov_rect.attr({
            x: d => that.brushScale(d[0]),
            width: d => this.brushScale(d[1]) - this.brushScale(d[0])
        });

        that.zero_slider_ov_rect = ov_rect;

        brushAreaEnter.call(brush);
        brushAreaEnter.selectAll('rect').attr({
            height: 15
        });
        brushAreaEnter.selectAll('.background').remove();

        brushAreaEnter.selectAll('.resize.w').append('text').text('\uf060').attr({
            class: 'brush_handles',
            x: -11,
            y: 10
        });
        brushAreaEnter.selectAll('.resize.e').append('text').text('\uf061').attr({
            class: 'brush_handles',
            x: 1,
            y: 10
        });

        if (that.current.brush_extent[0] != that.current.brush_extent[1]) {
            brushArea.call(brush.extent([
                that.current.brush_extent[0] - that.current.zero_left,
                that.current.brush_extent[1] + that.current.zero_right
            ]))
        }

        that.zero_brush = brush;


        function brushed() {
            var extent0 = brush.extent(),
                extent1;
            var d0, d1, diff_d0, diff_d1;

            // if dragging, preserve the width of the extent
            if (d3.event.mode === "move") {
                d0 = Math.floor(extent0[0]);
                d1 = Math.round(d0 + extent0[1] - extent0[0]);

            }
            //
            //// otherwise, if resizing, round both dates
            else {
                d0 = Math.floor(extent0[0]);
                d1 = Math.ceil(extent0[1]);

            }
            //

            diff_d0 = that.current.brush_extent[0] - Math.min(d0, that.current.brush_extent[0]);
            diff_d1 = Math.max(d1, that.current.brush_extent[1]) - that.current.brush_extent[1];

            extent1 = [Math.min(d0, that.current.brush_extent[0]), Math.max(d1, that.current.brush_extent[1])];

            var brushArea = d3.select(this);
            brushArea.call(brush.extent(extent1));

            that.eventHandler.trigger('zero_padding_changed', {left: diff_d0, right: diff_d1})

        }


    }

    data_wrangling(data) {
        this.data = data;
        var l = data.states[0].right - data.states[0].left + 1;

        this.xScale.domain([0, l - 1]).range([this.layout.cell_width / 2, l * this.layout.cell_width - this.layout.cell_width / 2]);
        this.brushScale.domain([0, l]).range([0, l * this.layout.cell_width]);
        this.line_opacity = .5 / (Math.log(l + 1) + 1);

        var cell_id_mapper = _.identity;
        if (this.data.cells.length > 0) {
            cell_id_mapper = d => this.data.cells[d];
        }

        this.data.draw_data = this.data.states[0].data.map((d, i) => {
            return {index: cell_id_mapper(i), values: d};
        }).filter(d => _.sum(d.values) != 0);

        this.discretize_data();
    }

    query_context(position, data_set, source, rle) {
        var that = this;

        var closestQuery = url + "/api/context/?pos=" + position
            + '&data_set=' + data_set
            + '&left=' + LEFT_CONTEXT + '&right=' + RIGHT_CONTEXT + '&dimensions=states,cell_count,words'
            + '&data_transform=' + (that.source_info.transform)
            + "&threshold=" + (that.current.selection.threshold);
        if (source) {
            closestQuery += '&source=' + source
        }
        if (rle) {
            closestQuery += '&rle=' + rle
        }

        $.ajax(closestQuery, {
            dataType: 'json',
            success: function (data) {
                that.data_wrangling(data);
                that.draw_word_slider();
                that.draw_zero_slider();
                that.redraw();

                d3.selectAll('#loading').transition().style({
                    opacity: 0,
                    'pointer-events': 'none'
                });

                d3.selectAll('#headline,#vis').transition().style({
                    opacity: 1
                });

                that.current.source = data.source;
                that.eventHandler.trigger('replace_url', {source: data.source})


            }
        })
    };

    redraw () {
        var that = this;

        // if cell order is modified by sub-set queries assign the right cell ids
        // if all cells returned then all IDs should be index position in array
        var draw_data = this.data.draw_data;

        this.result_view.update({
            threshold: this.current.selection.threshold,
            selected_cells: this.selected_cells_for_query,
            excluded_cells: this.current.selection.excluded_cells
        }, {
            zero_left: this.current.zero_left,
            zero_right: this.current.zero_right
        });


        this.update_pc_lines();

        var selected_cell_data = draw_data.filter(d => _.includes(this.selected_cells_for_query, d.index));
        var discretized_cell_data = this.selected_cells_for_query.map(cell_index => {
            return {index: cell_index, values: this.discrete_states[cell_index]};
        });

        this.update_mini_preview();
        this.update_mini_range_preview(discretized_cell_data);
        this.update_cell_selectors();
        this.update_words(selected_cell_data, discretized_cell_data);
    }

    update_pc_lines() {
        if (this.pc_plots.length < 1) {
            var primary_pc_plot = new PCPlot(this.content_group.node(), this.layout.pc.x, this.layout.pc.y,
                                             {threshold: this.current.selection.threshold},
                                             {
                                                 xScale: this.xScale,
                                                 yScale: this.yScale,
                                                 hover_event_name: 'cell_hovered',
                                                 word_brush_scale: this.brushScale
                                             });
            primary_pc_plot.bind_event_handler(this.eventHandler);
            this.pc_plots.push(primary_pc_plot)
        }

        this.pc_plots[0].update(
            {
                draw_data: this.data.draw_data,
                threshold: this.current.selection.threshold,
                selected_cells: this.selected_cells_for_query,
                excluded_cells: this.current.selection.excluded_cells,
                active_brush_selection: this.current.brush_extent[0] == this.current.brush_extent[1],
                brush: this.current.brush_extent
            },
            {yScale: this.yScale});

        this.pc_plots[0].redraw();
    }

    update_mini_preview() {
        var selected_cell_corrected = _.difference(this.selected_cells_for_query,
                                                   this.current.selection.excluded_cells);
        var max = 0;
        var aggregated_data = this.cell_active_per_timestep.map((ac) => {
            var active_cells = ac[1];
            var intersection = _.intersection(active_cells, selected_cell_corrected);
            var union = _.union(active_cells, selected_cell_corrected);
            var res = (1. * intersection.length) / union.length;
            max = Math.max(max, res);
            return res;
        });

        var discrete_scale = d3.scale.linear().domain([0, max]).range([this.layout.mini_preview.h, 0]);
        var discrete_line = d3.svg.area()
            .x((d, i) => this.brushScale(i))
            .y0(d => discrete_scale(d))
            .y1(this.layout.mini_preview.h)
            .interpolate('step-after');

        var pc_line_discrete = this.mini_preview.selectAll(".pc_area_discrete").data([aggregated_data]);
        pc_line_discrete.exit().remove();

        pc_line_discrete.enter().append("path").attr({
            "class": "pc_area_discrete"
        });
        pc_line_discrete.attr({
            d: discrete_line
        });
    }

    update_mini_range_preview(discretized_cell_data) {
        var start_brush = this.current.brush_extent[0];


        var cell_length_lines = discretized_cell_data.map((cell) => {
            var res = [];
            var last_index = -1;
            var q_range = [];
            cell.values.forEach((c_value, c_index) => {
                if (c_value == 1) {
                    if (last_index == -1) {
                        last_index = c_index
                    }
                } else {
                    if (last_index != -1) {
                        res.push({
                            index: cell.index,
                            range: [last_index, c_index - 1]
                        });
                        if (_.inRange(start_brush, last_index, c_index)) {
                            q_range = [last_index, c_index - 1]
                        }
                        last_index = -1;
                    }
                }
            });

            if (last_index != -1) {
                var c_index = cell.values.length;
                res.push({index: cell.index, range: [last_index, c_index - 1]});
                if (_.inRange(start_brush, last_index, c_index)) {
                    q_range = [last_index, c_index - 1]
                }
            }
            return {index: cell.index, values: res, sort_1: q_range[0], sort_2: q_range[1]}
        });


        cell_length_lines.sort((a, b) => {
            var res = a.sort_1 - b.sort_1;
            if (res == 0) {
                res = b.sort_2 - a.sort_2
            }
            return res;
        });

        cell_length_lines = _.slice(cell_length_lines, 0, 21);

        var cell_length_line_group = this.mini_range_preview.selectAll(".cell_length_line_group")
            .data(cell_length_lines, d => d.index);
        cell_length_line_group.exit().remove();

        cell_length_line_group.enter().append("g").attr({
            "class": "cell_length_line_group"
        });
        cell_length_line_group.attr({
            "transform": (d, i) =>  "translate(0," + (i * 5) + ")"
        });

        var cell_length_line = cell_length_line_group.selectAll(".cell_length_line")
            .data(d => d.values);

        cell_length_line.exit().remove();

        cell_length_line.enter().append("line").attr({
            "class": d => "cell_length_line cell_" + d.index
                + (_.includes(this.current.selection.excluded_cells, d.index) ? ' deselected' : '')   
        });

        cell_length_line.attr({
            "class": d =>
                "cell_length_line cell_" + d.index
                + (_.includes(this.current.selection.excluded_cells, d.index) ? ' deselected' : ''),
            x1: d => this.brushScale(d.range[0]),
            x2: d => this.brushScale(d.range[1] + 1),
            y1: 3,
            y2: 3
        }).on({
            'mouseenter': d => this.eventHandler.trigger('cell_hovered', {cell: d.index, active: true}),
            'mouseout': d => this.eventHandler.trigger('cell_hovered', {cell: d.index, active: false}),
            'click': d => this.eventHandler.trigger('cell_clicked', d.index)
        });


    }

    update_cell_selectors() {        
        var cell_selector = this.cell_selectors_group.selectAll(".cell_selector").data(this.selected_cells_for_query);
        cell_selector.exit().remove();

        // --- adding Element to class cell_selector
        var cell_selectorEnter = cell_selector.enter().append("g");

        cell_selectorEnter.append("rect").attr({
            "width": this.layout.cell_selectors.cw,
            "height": this.layout.cell_selectors.h
        });

        cell_selectorEnter.append("text").attr({
            y: this.layout.cell_selectors.h / 2 + 5,
            x: this.layout.cell_selectors.cw / 2

        }).style({
            'text-anchor': 'middle',
            'font-size': '9pt',
            'pointer-events': 'none'
        });


        cell_selector.attr({
            "class": d => "cell_selector cell_" + d + (_.includes(this.current.selection.excluded_cells, d) ? '' : ' selected'),
            "transform": (d, i) =>  "translate(" + (i * this.layout.cell_selectors.cw) + "," + 0 + ")"
        }).on({
            'mouseenter': d => this.eventHandler.trigger('cell_hovered', {cell: d, active: true}),
            'mouseout': d => this.eventHandler.trigger('cell_hovered', {cell: d, active: false}),
            'click': d => this.eventHandler.trigger('cell_clicked', d)
        });

        cell_selector.select('text').text(d => d);
    }

    update_words(selected_cell_data, discretized_cell_data) {
        var word = this.label_group.selectAll(".word").data(this.data.words[0].words);
        word.exit().remove();
        
        // --- adding Element to class word
        var wordEnter = word.enter().append("g").attr({
            "class": "word"
        });
        
        wordEnter.append('rect').attr({
            class: 'wordBG',
            width: this.layout.cell_width,
            height: 15
        }).style({fill: 'white', stroke: 'none'});
        
        wordEnter.append('text').attr({
            class: 'noselect',
            y: 13
        });
        
        
        // --- changing nodes for word
        word.attr({
            "transform": (d, i) =>
                "translate(" + (this.brushScale(i)) + "," + 0 + ")"
        });
        
        word.select('text')
            .attr({
                "transform": d => {
                    this.text_length_tester.text(d);
                    var tl = this.text_length_tester[0][0].getComputedTextLength();
                    if (tl > this.layout.cell_width - 3) {
                        return "translate(2,0)scale(" + (this.layout.cell_width - 3) / tl + ",1)";
                    } else {
                        return "translate(2,0)";
                    }
                }
            })
            .text(d => d);
        
        var wordBG = word.select('.wordBG');
        
        // update word backgrounds w.r.t. selection:
        if (selected_cell_data.length > 0) {
            var discrete_scale = d3.scale.linear()
                .domain([0, this.selected_cells_for_query.length - this.current.selection.excluded_cells.length])
                .range(['#f7f7f7', '#0571b0']);
            
            var agg_data = discretized_cell_data.filter(d => !_.includes(this.current.selection.excluded_cells, d.index));
            var aggregated_data = selected_cell_data[0].values.map((nothing, x_index) =>
                                                                   _.sum(agg_data.map(d => d.values[x_index]))
                                                                  );
            wordBG.style({fill: (d, i) => discrete_scale(aggregated_data[i])});
        } else {
            wordBG.style({fill: 'white'})
        }
        
        
        this.label_group.selectAll(".separator_line").data([LEFT_CONTEXT]).enter().append("line").attr({
            "class": "separator_line",
            x1: d => this.brushScale(d) - 1,
            x2: d => this.brushScale(d) - 1,
            y1: -5,
            y2: this.layout.cell_selectors.h + 5
        }).style({
            'pointer-events': 'none',
            'stroke-width': 1
        });
    }    
}


