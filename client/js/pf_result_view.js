/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 6/4/16.
 */

function createButton(parent, x, y, width, height, classes, text, onFunction) {
    var qButtonG = gr(parent, classes + ' svg_button', {x, y})
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
function create_radio_state_buttons(parent, x, y, width, height, classes, values, active_value, onFunction) {
    var qButtonG = gr(parent, '', {x, y})
    
    var all_radios = qButtonG.selectAll('svg_radio_button').data(values);
    all_radios.exit().remove();
    var all_radios_enter = all_radios.enter().append('g').attr({
        class: classes + ' svg_radio_button',
        "transform": (d, i) => tr({x: i*width, y:0})
    });
    
    all_radios_enter.append('rect').attr({
        class: 'bg',
        width: width,
        height: height
    }).on('click', onFunction);
    
    all_radios_enter.append('text').attr({
        x: width / 2,
        y: height - 3
    }).text(d => d);
    
    all_radios.classed('selected', d => (d == active_value))
}
 

class ResultView {
    constructor(parent, x, y, data, options) {        
        this.event_list = {
            heatmap_item_hovered: 'heatmap_item_hovered',
            circle_hovered: 'circle_hovered'
        };
        
        //=== queries ===
        this.left_context = 2;
        this.right_context = 15;
        this.sort_mode = 'cells';
        this.query_mode = 'fast';
        
        this.layout = {
            ch: 16,
            cw: 35,
            cell_selectors: {
                cw: 30, h: 15
            },
            result_histogram: {
                x: 250, y: 0, h: 60, w: 400, cw: 12
            },
            result_cells: {
                x: 0, y: 65, ch: 16
            },
            result_view: {
                x: 20, y: 85
            },
            result_link: {
                x: 0, y: 85
            },
            query_buttons: {
                x: 0, y: 0, cw: 150, h: 15
            }
        };
        
        this.data = {
            selected_cells_in_results: []
        };
        this.options = {
            xScale: d3.scale.linear().domain([0, this.left_context - this.right_context + 1])
                .range([0, this.layout.cw * (this.left_context - this.right_context + 1)])
        };
        this.current = {
            rect_selection: null,
            circle_selection: null
        };
        
        this.all_content_groups = [];
        this.parent = d3.select(parent);
        this.content_group = gr(this.parent,'', {x, y});

        this.create_groups();
        
        // Heat maps
        this.heatmap_ids = Object.keys(globalInfo['info']['meta']).map(d => 'meta_' + d);
        this.heatmaps = {};
        this.cummulative_heatmap_for_selected_cells = [];
        this.cell_count_hm_data = [];
        this.opacity_map = [];        
        this.results = [];    
        this.update(data, options);
        
        this.create_ui();
    }
        
    update(data, options) {
        Object.keys(data).map( d => this.data[d] = data[d]);
        Object.keys(options).map(d => this.options[d] = options[d]);
    }

    create_groups() {
        this.result_cells_group = gr(this.content_group, 'result_cells_group', this.layout.result_cells);
        this.all_content_groups.push(this.result_cells_group);
        
        this.result_view_group = gr(this.content_group, 'result_view_group', this.layout.result_view);
        this.all_content_groups.push(this.result_view_group);
        
        this.result_link_group = gr(this.content_group, 'result_link_group', this.layout.result_link);
        this.all_content_groups.push(this.result_link_group);
        
        
        this.result_view_group_bg = gr(this.result_view_group, 'result_view_group_bg bg', {x:0, y:0})
            .attr("opacity", 0.5);


        // Length histogram 
        this.result_view_group_bg_circle = gr(this.result_view_group, 'result_view_group_bg_circle bg',{x:0, y:0});        
        this.result_histogram = gr(this.content_group, 'result_histogram', this.layout.result_histogram);
        this.result_histogram.append('text').attr({
            class: 'result_histogram_name',
            x: -3,
            y: 12
        }).text('length dist:');
        this.all_content_groups.push(this.result_histogram);        
    }
    
    wrangle_data() {}
    
    update_heatmaps(options) {
        var x_offset = this.options.xScale(this.left_context + 1 + this.right_context) + 30;
        var cell_width = 10;
        var cell_height = this.layout.ch;
        var heatmap_padding = (this.left_context + 1 + this.right_context) * cell_width + 15;
        
        if (CELL_COUNT_HM_ID in this.heatmaps) {
            this.heatmaps[CELL_COUNT_HM_ID].updateData(this.cell_count_hm_data, null, {});
            this.heatmaps[CELL_COUNT_HM_ID].draw();
        } else {
            var hm_options = {
                cellWidth: cell_width,
                cellHeight: cell_height,
                title: 'match count',
                id: CELL_COUNT_HM_ID
                
            };
            var hm = new HeatMap(
                this.result_view_group.node(),
                this.cell_count_hm_data, null,
                0 + x_offset, 0,
                hm_options);
            hm.bindEvents(this.event_handler);
            hm.draw();
            this.heatmaps[CELL_COUNT_HM_ID] = hm;
        }
        
        
        if (!options.skip_heatmap) {
            var draw_options = {
                opacity: this.opacity_map
            };
            this.heatmap_ids.forEach((hm_id, i) => {
                if (hm_id in this.heatmaps) {
                    if (!options.skip_hm_data_update)
                        this.heatmaps[hm_id].updateData(this.results[hm_id], null, {});
                    this.heatmaps[hm_id].draw(draw_options);
                    
                } else {
                    var hm_options = {
                        cellWidth: cell_width,
                        cellHeight: cell_height,
                        title: hm_id.replace('meta_', ''),
                        id: hm_id
                        
                    };
                    
                    if (hm_id.startsWith('meta_')) {
                        hm_options.colorScale = globalInfo['info']['meta'][hm_id.substring(5)].vis.color_scale;
                        hm_options.datatype = globalInfo['info']['meta'][hm_id.substring(5)].vis.type;
                        hm_options.noAutoColorScale = true;
                    }
                    var hm = new HeatMap(
                        this.result_view_group.node(),
                        this.results[hm_id], null,
                        (i + 1) * heatmap_padding + x_offset, 0,
                        hm_options);
                    hm.bindEvents(this.event_handler);
                    hm.draw(draw_options);
                    this.heatmaps[hm_id] = hm;
                }
            });
        }
    }

    update_bg_rects(options) {
        var rect_hm = this.heatmaps[this.current.rect_selection];
        var hm_data;
        if (rect_hm) {
            hm_data = rect_hm.data;
        } else {
            // fake a heatmap
            hm_data = this.results.words.map((d, x) =>
                                             d.words.map((_, y) => {
                                                 return {x: x, y: y}; }));
            hm_data = _.flatten(hm_data);
        }
        
        var background_rect = this.result_view_group_bg.selectAll(".background_rect")
            .data(hm_data);
        background_rect.exit().remove();
        background_rect.enter().append("rect").attr({
            width: this.layout.cw - 1,
            height: this.layout.ch - 2
        }).style({
            fill: 'white'
        });
        
        background_rect.attr({
            "class": d => "background_rect x" + d.x + '_y' + d.y,
            x: d => this.options.xScale(d.y) + (d.y >= this.left_context ? 5 : 0),
            y: d => d.x * this.layout.ch
        });
        
        var use_opacity = (rect_hm
                           && this.current.rect_selection != CELL_COUNT_HM_ID
                           && this.heatmaps[this.current.rect_selection].datatype != 'scalar');
        
        if (options.no_transition) {
            background_rect.style({
                fill:  d => rect_hm ? rect_hm.options.colorScale(d.value) : 'white',
                'fill-opacity': d => use_opacity ? this.opacity_map[d.x][d.y] : 1
            });
        } else {
            background_rect.transition().style({
                fill: d => rect_hm ? rect_hm.options.colorScale(d.value) : 'white',
                'fill-opacity': d => use_opacity ? this.opacity_map[d.x][d.y] : 1
            });
        }
        background_rect.on({
            'mouseover':  d => 
                this.event_handler.trigger(this.event_list.heatmap_item_hovered,
                                           {x: d.x, y: d.y, active: true}),
            'mouseout': d => 
                this.event_handler.trigger(this.event_list.heatmap_item_hovered,
                                           {x: d.x, y: d.y, active: false})   
        });
    }

    update_bg_circles(options) {
        var rect_hm = this.heatmaps[this.current.circle_selection];
        var hm_data = [];
        if (rect_hm) 
            hm_data = rect_hm.data;
        
        // Make a circle.
        var background_circle = this.result_view_group_bg_circle.selectAll(".background_circle")
            .data(hm_data);
        background_circle.exit().remove();
        
        background_circle.enter().append("circle").attr({
            r: 3
        }).style({
            fill: d => rect_hm ? rect_hm.options.colorScale(d.value) : 'white',
            stroke: 'white',
            'stroke-width': '1',
            'stroke-opacity': .5
        });
        
        background_circle.attr({
            "class": d => "background_circle x" + d.x + '_y' + d.y,
            cx: d => this.options.xScale(d.y) + (d.y >= this.left_context ? 5 : 0) + 3,
            cy: d => (d.x) * this.layout.ch + 3
        });
        // End
        
        var use_opacity = false;
        
        if (options.no_transition) {
            background_circle.style({
                fill: d => rect_hm ? rect_hm.options.colorScale(d.value) : 'white',
                'fill-opacity': d => use_opacity ? this.opacity_map[d.x][d.y] : 1
            });
        } else {
            background_circle.transition().style({
                fill: d => rect_hm ? rect_hm.options.colorScale(d.value) : 'white',
                'fill-opacity': d => use_opacity ? this.opacity_map[d.x][d.y] : 1
            });
        }
        
        background_circle.on({
            'mouseover': d => {
                this.event_handler.trigger(this.event_list.circle_hovered, {value: d.value, active: true});
                this.event_handler.trigger(this.event_list.heatmap_item_hovered, {x: d.x, y: d.y, active: true});
            },
            'mouseout': d => {
                this.event_handler.trigger(this.event_list.circle_hovered, {value: d.value, active: false});
                this.event_handler.trigger(this.event_list.heatmap_item_hovered, {x: d.x, y: d.y, active: false});
            }
        });
    }
    
    update_words(options) {
        var result_group = this.result_view_group.selectAll(".result_group").data(this.results.words);
        result_group.exit().remove();
        
        result_group.enter().append("g").attr({
            "class": "result_group"
        });
        
        result_group.attr({
            "transform": (d, i) => tr({x: 0, y: i * this.layout.ch}) 
        });
        
        var words = result_group.selectAll('.word').data(d => d.words);
        
        words.enter().append('text').attr({
            class: "word"
        });
        words.attr({
            transform: (d, i) => {
                this.options.text_length_tester.text(d);
                var tl = this.options.text_length_tester[0][0].getComputedTextLength();
                if (tl > (this.layout.cw - 3)) {
                    return "translate(" + (this.options.xScale(i) + (i >= this.left_context ? 5 : 0)) + "," + (this.layout.ch - 4) + ")scale(" + (this.layout.cw - 3) / tl + ",1)";
                } else {
                    return "translate(" + (this.options.xScale(i) + (i >= this.left_context ? 5 : 0)) + "," + (this.layout.ch - 4) + ")";
                }
            }
        }).text(d => d);
    }

    update_cell_selectors(options) {
        var cell_selector = this.result_cells_group.selectAll(".cell_selector").data(this.results.cells);
        cell_selector.exit().remove();
        
        var cell_selectorEnter = cell_selector.enter().append("g");
        
        cell_selectorEnter.append("rect").attr({
            "width": this.layout.cell_selectors.cw,
            "height": this.layout.cell_selectors.h
        });
        
        cell_selectorEnter.append("text").attr({
            y: this.layout.cell_selectors.h / 2 + 5,
            x: this.layout.cell_selectors.cw / 2
            
        }).style({
            'fill': 'black',
            'stroke': 'none',
            'text-anchor': 'middle',
            'font-size': '9pt',
            'pointer-events': 'none'
        });
        
        cell_selector.attr({
            "class": d => "cell_selector cell_" + d,
            "transform":  (d, i) => tr({x: i * this.layout.cell_selectors.cw, y:0})
        }).on({
            'mouseenter': d => {
                this.event_handler.trigger(Event_list.cell_hovered, {cell: d, active: true});
                this.event_handler.trigger('result_cell_hovered', {cell: d, active: true});
            },
            'mouseout':  d => {
                this.event_handler.trigger(Event_list.cell_hovered, {cell: d, active: false});
                this.event_handler.trigger('result_cell_hovered', {cell: d, active: false});
            },
            'click': d => {
                this.event_handler.trigger('result_cell_clicked', {cell: d});
            }
        });
        
        cell_selector.classed('selected', d =>
                              _.includes(this.data.selected_cells_in_results, d));
        
        cell_selector.select('text').text(d => d);        
    }
    
    update_histograms(options) {
        // Create and update the histograms. 
        var fuzzyLengthHistogram = this.results.index_query.fuzzy_length_histogram;
        var minimal_relevant_length = 2;
        var flh_length = fuzzyLengthHistogram.length - minimal_relevant_length;
        var h_layout = this.layout.result_histogram;
        var strict_length_histogram = this.results.index_query.strict_length_histogram;
        
        var hScaleY = d3.scale.pow().exponent(.5).domain([0, _.max(fuzzyLengthHistogram)]).range([0, h_layout.h]);
        var hScaleX = d3.scale.ordinal().domain(_.range(0, flh_length))
            .rangeBands([0, Math.min(h_layout.cw * flh_length, h_layout.w)], .1);
        
        var main_layer = this.result_histogram.selectAll('.main_layer').data([0]);
        main_layer.enter().append('g').attr({class: 'main_layer'});
        
        var overlay_layer = this.result_histogram.selectAll('.overlay_layer').data([0]);
        overlay_layer.enter().append('g').attr({class: 'overlay_layer'}).append('text').attr({
            class: 'label_text',
            opacity: 0
        });
        
        
        var histogram_bg = main_layer.selectAll(".histogram_bg").data(_.range(0, flh_length));
        var that = this;
        histogram_bg.exit().remove();
        histogram_bg.enter().append("rect");
        histogram_bg.attr({
            "class": "histogram_bg",
            y: 0,
            height: h_layout.h,
            x:  hScaleX,
            width: hScaleX.rangeBand
        }).on({
            'mouseenter': d => {
                var strict_value = strict_length_histogram[(d + minimal_relevant_length)];
                strict_value = strict_value || 0;
                overlay_layer.selectAll('.label_text')
                    .attr({
                        x: hScaleX(d) + hScaleX.rangeBand() + 4,
                        y: 12,
                        opacity: 1
                    }).text('l=' + (d + minimal_relevant_length) + ' |all='
                            + fuzzyLengthHistogram[(d + minimal_relevant_length)]
                            + ' |strict=' + strict_value)
            },
            'mouseout':  () =>
                overlay_layer.selectAll('.label_text')
                    .attr({opacity: 0}),
            'click': function (index) {
                var isSelected = d3.select(this).classed('selected');
                if (isSelected) {
                    this.data.phrase_length = null;
                    d3.select(this).classed('selected', null);
                } else {
                    this.data.phrase_length = index + minimal_relevant_length;
                    main_layer.selectAll(".histogram_bg").classed('selected',  d => d == index)   
                }
                that.event_handler.trigger('open_query');
            }
        });
       
        var histogram_fuzzy = main_layer.selectAll(".histogram_fuzzy")
            .data(_.slice(fuzzyLengthHistogram, minimal_relevant_length));
        histogram_fuzzy.exit().remove();
        histogram_fuzzy.enter().append("rect").attr({"class": "histogram_fuzzy"});
        histogram_fuzzy.attr({
            y: d => this.layout.result_histogram.h - hScaleY(d),
            height: d =>  hScaleY(d) + 1,
            x: (d, i) => hScaleX(i),
            width: () =>  hScaleX.rangeBand()
        });
        
        var histogram_strict = main_layer.selectAll(".histogram_strict")
            .data(_.slice(strict_length_histogram, minimal_relevant_length));
        histogram_strict.exit().remove();
        histogram_strict.enter().append("rect").attr({"class": "histogram_strict"});
        histogram_strict.attr({
            y: d => this.layout.result_histogram.h - hScaleY(d),
            height: d => hScaleY(d),
            x: (d, i) => hScaleX(i),
            width: () => hScaleX.rangeBand()
        });
    }
    
    update_links() {
        var result_link = this.result_link_group.selectAll(".result_link").data(this.results.index_query.data);
        result_link.exit().remove();
        
        result_link.enter().append("text").attr({
            "class": "result_link navigation_button"
        });
        
        result_link
            .attr({y: (d, i) => (i) * this.layout.ch + 14})
            .text("\uf0c1")
            .on('click',  (d, i) =>
                this.event_handler.trigger(Event_list.new_page,
                                           {replace: {pos: d[0],
                                                      brush: LEFT_CONTEXT + ',' + (d[2] + LEFT_CONTEXT),
                                                      padding: '1,0'}}));
    }

    redraw(draw_options_) {
        var options = draw_options_ || {};
                   
        this.update_heatmaps(options); // has to happen before update_bg_rects !!!
        this.update_bg_rects(options);    
        this.update_bg_circles(options);
        if (!options.skip_words) {
            this.update_words(options);
            this.update_words(options);
        }
        if (!options.skip_selectors) this.update_cell_selectors(options);
        
        // Only update histogram iff new query, length limitaions are local changes
        if (this.data.phrase_length == null) this.update_histograms(options);
        
        
        var separator_line = this.result_view_group.selectAll(".separator_line").data([this.left_context]);
        separator_line.exit().remove();
        separator_line.enter().append("line").attr({"class": "separator_line"});
        
        separator_line.attr({
            x1: d => this.options.xScale(d) + 2,
            x2: d => this.options.xScale(d) + 2,
            y1: 0,
            y2: this.layout.ch * this.results.index_query.data.length
        });
        
        this.update_links();
    }

    set_cell_count_hm(hm, hm_name) {
        this.cell_count_hm_data = hm;        
        if (hm_name == CELL_COUNT_HM_ID) {
            var lengths = this.results.index_query.data
                .map((d, i) => [this.left_context-1, d[2]+this.left_context+1])
            this.opacity_map = lengths
                .map(l => _.range(0,this.left_context + this.right_context+1)
                     .map((d, i) => _.inRange(i, l[0], l[1]) ? 1 : .1));
        } else {
            var max_per_row = hm.map((d) => d[this.left_context]);
            this.opacity_map = hm.map((x, row_id) => {
                var max = max_per_row[row_id];
                return x.map((y, i) =>
                             (y == max || i == this.left_context - 1 || (i > 0 && x[i - 1] == max)) ? 1 : 0.1)
            });
        }
    }

    _open_query() {
        var query_cells = _.difference(this.data.selected_cells, this.data.excluded_cells);
        var parameter = [
            'cells=' + query_cells.join(','),
            'threshold=' + this.data.threshold,
            'data_set=' + this.options.data_set,
            'data_transform=' + this.options.source_info.transform,
            'sort_mode=' + this.sort_mode,
            'query_mode=' + this.query_mode,
            'constrain_left=' + ((this.options.zero_left > 0) ? 1 : 0),
            'constrain_right=' + ((this.options.zero_right > 0) ? 1 : 0)
        ];
        
        if (this.options.source != null) {
            parameter.push('source=' + this.options.source)
        }
        
        if (this.data.phrase_length) {
            parameter.push('phrase_length=' + this.data.phrase_length)
        }
        
        
        this.event_handler.trigger('replace_url', {queried: true});
        
        var query = this.options.url + '/api/closest_sequences?' + parameter.join('&');
        
        this.all_content_groups.forEach(d => d.transition().style({opacity: 0, 'pointer_events': 'none'}));
        
        var wt = this.content_group.selectAll('.warning_text').data(['loading...'])
        wt.enter().append('text').attr({class: 'warning_text', x: 20, y: 60});
        wt.text(d => d);
        
        $.ajax(query, {
            dataType: 'json',
            success:  index_query => {
                var all_pos = index_query.data.map(d => d[0]);
                if (all_pos.length > 0) {
                    var dimensions = ['states,words,cell_count'];
                    this.content_group.selectAll('.warning_text').remove();
                    this.all_content_groups.forEach(d => d.transition().style({opacity: 1, 'pointer_events': null}));
                    
                    Object.keys(globalInfo['info']['meta']).forEach(d => dimensions.push('meta_' + d));                        
                    $.ajax(
                        url + '/api/context/?pos=' + all_pos.join(',')
                            + '&dimensions=' + dimensions.join(',')
                            + '&threshold=' + this.data.threshold
                            + '&cells=' + query_cells.join(',')
                            + '&left=' + this.left_context
                            + '&right=' + (this.right_context)
                            + '&data_set=' + (this.options.data_set)
                            + (this.options.source ? '&source=' + this.options.source : ''
                               + '&data_transform=' + (this.options.source_info.transform)),
                        {dataType: 'json',
                         success:  data => {
                             this.results = data;
                             this.results.index_query = index_query;
                             this.selected_cells_in_results = [];
                             this.cummulative_heatmap_for_selected_cells = [];
                             this.set_cell_count_hm(this.results[CELL_COUNT_HM_ID], CELL_COUNT_HM_ID);
                             this.redraw({});
                         }
                        });
                }
                else {
                    wt.text(() => 'no results');
                }
            }
        });
    }

    _result_cell_clicked(e, data) {
        if (_.includes(this.selected_cells_in_results, data.cell)) {
            _.pull(this.selected_cells_in_results, data.cell)
        } else {
            this.selected_cells_in_results.push(data.cell);
        }
        
        // update bias for cell_count heatmap
        if (this.selected_cells_in_results.length > 0) {
            var cell_indices = this.selected_cells_in_results
                .map(d => _.indexOf(this.results.cells, d));
            
            this.cummulative_heatmap_for_selected_cells = this.results.states
                .map(d =>
                     d.data[0].map((_, i) => {
                         var sum = 0;
                         cell_indices.forEach(cell_index => 
                                              sum += d.data[cell_index][i] >= this.data.threshold ? 1 : 0
                                             );
                         return sum;
                     }));
            this.set_cell_count_hm(this.cummulative_heatmap_for_selected_cells, '');
            
        } else {
            this.cummulative_heatmap_for_selected_cells = [];
            this.set_cell_count_hm(this.results[CELL_COUNT_HM_ID], CELL_COUNT_HM_ID);
            
        }
        
        this.redraw({
            skip_hm_data_update: true,
            skip_words: true, skip_selectors: true, no_transition: true
        });
        this.result_cells_group.selectAll(".cell_selector")
            .classed('selected', d =>
                     _.includes(this.selected_cells_in_results, d));
    }

    bind_event_handler(event_handler) {
        this.event_handler = event_handler;
        this.event_handler.bind('open_query', () => this._open_query());
        
        this.event_handler.bind('result_cell_hovered', (e, data) => {
            var hm_id = CELL_COUNT_HM_ID;
            var use_bias = this.cummulative_heatmap_for_selected_cells.length > 0;
            
            if (data.active && !_.includes(this.selected_cells_in_results, data.cell)) {
                var cell_index = _.indexOf(this.results.cells, data.cell);
                var hm_data = this.results.states
                    .map((d, x) => d.data[cell_index]
                         .map((dd, y) =>
                              (use_bias ? this.cummulative_heatmap_for_selected_cells[x][y] : 0)
                              + (dd >= this.data.threshold ? 1 : 0)));
                this.set_cell_count_hm(hm_data, '');
            }
            else if (use_bias) 
                this.set_cell_count_hm(this.cummulative_heatmap_for_selected_cells, '');
            else 
                this.set_cell_count_hm(this.results[hm_id], hm_id);

            this.redraw({
                skip_hm_data_update: true,
                skip_words: true, skip_selectors: true, no_transition: true
            });
        });
        
        this.event_handler.bind('result_cell_clicked', (e, data) => this._result_cell_clicked(e, data));
                
        // HEATMAP EVENTS
        this.event_handler.bind('heatmap_mapping_rect_selected', (e, hm_id) => {
            this.current.rect_selection = hm_id;
            this.redraw({skip_heatmap: true, skip_words: true});
        });
        
        this.event_handler.bind('heatmap_mapping_circle_selected', (e, hm_id) => {
            this.current.circle_selection = hm_id;
            this.redraw({skip_heatmap: true, skip_words: true});
        });
                
        this.event_handler.bind('heatmap_item_hovered', (e, data) => {
            var hovered = this.result_view_group_bg.selectAll(".x" + data.x + "_y" + data.y);
            hovered.classed('hovered', data.active);
        });
        
        this.event_handler.bind(this.event_list.circle_hovered, (e, data) => {
            if (data.active) 
                this.result_view_group_bg_circle.selectAll('.background_circle').transition()
                .attr({
                    r: d => d.value == data.value ? 5 : 3,
                    filter: d => d.value == data.value ? 'url(#shadow1)' : null
                });
            else 
                this.result_view_group_bg_circle.selectAll('.background_circle').transition()
                .attr({r: 3, filter: null}); 
        })        
    };
    
    destroy() {
        this.content_group.remove();
    }

    create_ui() {
        createButton(this.content_group,
                     this.layout.query_buttons.x, this.layout.query_buttons.y + this.layout.query_buttons.h + 5,
                     this.layout.query_buttons.cw, this.layout.query_buttons.h,
                     'open_query', 'match',
                     () => {
                         this.data.phrase_length = null;
                         this.sort_mode = 'cells';
                         this.event_handler.trigger('open_query');
                     });
               
        create_radio_state_buttons(this.content_group,
                                   this.layout.query_buttons.x, this.layout.query_buttons.y,
                                   this.layout.query_buttons.cw / 2, this.layout.query_buttons.h,
                                   'query_mode', ['fast', 'precise'], this.query_mode,
                                   value => {
                                       this.query_mode = value;
                                       this.content_group.selectAll('.query_mode').classed('selected',  (d, i) => d == value);
                                   }
                                  );        
    }

}
