/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/29/16.
 */


const CELL_COUNT_HM_ID = 'cell_count';

const Event_list = {
  threshold_update: 'threshold_update'

};

/**
 * PatternFinder Visualization class
 *
 * @param parent - the parent node
 * @param x - x pos
 * @param y - y pos
 * @param options - options
 * @constructor
 */
function PatternFinderVis(parent, x, y, options) {

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
    query_buttons: {
      x: 20, y: 420, cw: 150, h: 15
    },
    result_cells: {
      x: 20, y: 460, ch: 16
    },
    result_view: {
      x: 20, y: 490, ch: 16
    },
    result_histogram: {
      x: 270, y: 420, h: 60, w: 400, cw: 15
    },
    cell_width: 35,
    low_pass_button: {
      x: 100, y: 3, w: 150, h: 15
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

  //=== queries ===
  this.left_context = 2;
  this.right_context = 15;

  //=== client-side cell selection ===
  this.selected_cells_for_query = []; // query: these cells NAND current.selection.excluded_cells are excluded !!!
  this.selected_cells_in_results = [];

  // == state variables to load and save ==
  this.current = {
    pos: 1000,
    data_set: 0,
    source: null,
    brush_extent: [],
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

  //=== heatmap ===
  this.heatmap_ids = Object.keys(globalInfo['info']['meta']).map(function (d) {return 'meta_' + d;});
  this.heatmaps = {};
  this.cummulative_heatmap_for_selected_cells = [];
  this.cell_count_hm_data = [];
  this.opacity_map = [];
  this.pc_plots = [];

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

  this.query_context(this.current.pos, this.current.data_set, this.current.source, this.current.selection.low_pass_threshold);

  //if (options.pos && options.pos >= 0) {
  //  this.query_context(options.pos, options.data_set);
  //}


}

/**
 * update options from states or vice versa
 * @param update_states - true if options -> states; false if states -> options
 */
PatternFinderVis.prototype.sync_options_and_states = function (update_states) {
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
      current.brush_extent = brush_string.split(',').map(function (d) {return +d});
    }

    var zero_padding = options.padding;
    if (zero_padding && zero_padding.length > 0) {
      var tmp = zero_padding.split(',').map(function (d) {return +d});
      current.zero_left = tmp[0];
      current.zero_right = tmp[1];
    }


    var cell_string = options.cells;
    if (cell_string && cell_string.length > 0) {
      current.selection.cells = cell_string.split(',').map(function (d) {return +d;})

    }

    var ex_cell_string = options.ex_cell;
    if (ex_cell_string && ex_cell_string.length > 0) {
      that.current.selection.excluded_cells = ex_cell_string.split(',').map(function (d) {return +d;})
    }


  } else {
    // TODO: maybe
  }

};

/**
 * updates the cell selection
 * @returns {boolean}
 */
PatternFinderVis.prototype.update_cell_selection = function () {
  var that = this;
  var left = that.current.brush_extent[0];
  var right = that.current.brush_extent[1];
  if (left != right) {

    that.selected_cells_for_query = [];


    //var epsilon = 3;
    that.data.states[0].data.forEach(function (cell, cell_index) {
      var accept = true;
      cell.forEach(function (value, pos) {
        var evaluate = (
        (_.inRange(pos, left - that.current.zero_left, left) && value < that.current.selection.threshold) ||
        (_.inRange(pos, right, right + that.current.zero_right) && value < that.current.selection.threshold) ||
        (_.inRange(pos, left, right) && value >= that.current.selection.threshold) ||
        (pos < (left - that.current.zero_left)) || pos >= (right + that.current.zero_right));
        accept = accept && evaluate;

      });

      if (accept) that.selected_cells_for_query.push(cell_index)


    });

    if (that.selected_cells_for_query.length == that.data.states[0].data.length) {
      that.selected_cells_for_query = [];
    } // TODO: a bit of a hack :)

    return true;
  } else {
    return false;
  }

};


PatternFinderVis.prototype.reset_cell_selections = function (reset_pre_selected, reset_excluded) {
  var that = this;

  reset_pre_selected = reset_pre_selected || true;
  reset_excluded = reset_excluded || true;

  if (reset_pre_selected) {
    that.current.selection.cells = null;
    that.eventHandler.trigger('replace_url', {cells: null})
  }

  if (reset_excluded) {
    that.current.selection.excluded_cells = [];
    that.eventHandler.trigger('replace_url', {ex_cells: null})
  }


};

PatternFinderVis.prototype.bindEvents = function (eventHandler) {
  var that = this;

  this.eventHandler = eventHandler;

  eventHandler.bind('new_pivot_context', function (e, d) {
    that.current.pos = d.data.index;

    that.reset_cell_selections();

    that.query_context(that.current.pos, that.current.data_set, that.current.source);


    that.eventHandler.trigger('replace_url', {pos: that.current.pos});


  });

  eventHandler.bind('navigate', function (e, d) {
    that.current.pos = that.current.pos + d;

    that.current.brush_extent = that.current.brush_extent.map(function (b) {return b - d});

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
      + '?left=20&right=20&threshold=' + that.current.selection.threshold
      + '&rle=' + that.current.selection.low_pass_threshold
      + '&data_set=' + (that.current.data_set)
      + '&data_transform=' +(that.source_info.transform);

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
          cell_id_mapper = function (d) {return that.data.cells[d]};
        }


        that.data.draw_data = that.data.states[0].data.map(function (d, i) {
          return {index: cell_id_mapper(i), values: d};
        }).filter(function (d) {return _.sum(d.values) != 0});

        that.update_cell_selection();
        that.redraw();
        that.eventHandler.trigger('replace_url', {low_pass: that.current.selection.low_pass_threshold});
      }
    })


  });

  // gui event
  eventHandler.bind('map_opacity', function () {
    that.current.heatmap.map_cell_count_opacity = !that.current.heatmap.map_cell_count_opacity;
    that.query_button_group.selectAll('.map_opacity .selector')
      .text(function () {return that.current.heatmap.map_cell_count_opacity ? '\uf046' : '\uf096'});

    that.redraw_results({
      skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });


  });

  eventHandler.bind('brush_extent', function (e, d) {

    // performance shortcut
    if (_.isEqual(that.current.brush_extent, d.value)) return;

    that.reset_cell_selections();

    that.current.selection.cells = null; // no pre-defined cells

    that.current.brush_extent = d.value;
    if (that.update_cell_selection()) {
      that.redraw();
    }

    var brushArea = that.zero_slider_group.select(".brushArea");
    brushArea.call(that.zero_brush.extent(
      [that.current.brush_extent[0] - that.current.zero_left,
        that.current.brush_extent[1] + that.current.zero_right]));

    that.zero_slider_ov_rect.attr({
      x: function () {return that.brushScale(that.current.brush_extent[0])},
      width: function () {return that.brushScale(that.current.brush_extent[1]) - that.brushScale(that.current.brush_extent[0])}
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


  /*=================
   * HEATMAP EVENTS
   ===================*/

  eventHandler.bind('heatmap_mapping_rect_selected', function (e, hm_id) {
    that.current.heatmap.rect_selection = hm_id;
    that.redraw_results({skip_heatmap: true, skip_words: true});
  });

  eventHandler.bind('heatmap_mapping_circle_selected', function (e, hm_id) {
    that.current.heatmap.circle_selection = hm_id;
    that.redraw_results({skip_heatmap: true, skip_words: true});
  });

  eventHandler.bind('heatmap_item_hovered', function (e, data) {
    var hovered = that.result_view_group_bg.selectAll(".x" + data.x + "_y" + data.y);
    hovered.classed('hovered', data.active);
  });


  /*===============
   Cell events
   ================= */

  eventHandler.bind('cell_clicked', function (e, cell_id) {


      if (_.includes(that.current.selection.excluded_cells, cell_id)) {
        _.remove(that.current.selection.excluded_cells, function (d) {return d == cell_id;})

      } else {
        that.current.selection.excluded_cells.push(cell_id);
      }
      //that.cell_selectors_group.selectAll('.cell_' + cell_id).classed('selected', !de_active);
      //that.mini_range_preview.selectAll('.cell_' + cell_id).classed('deselected', de_active);
      //that.pc_group_overlay.selectAll('.cell_' + cell_id).classed('deselected', de_active);


      that.redraw();

      if (that.current.selection.excluded_cells.length > 0) {
        that.eventHandler.trigger('replace_url', {ex_cell: that.current.selection.excluded_cells.join(',')});
      }
      else {
        that.eventHandler.trigger('replace_url', {ex_cell: null});
      }

    }
  )
  ;


  eventHandler.bind('cell_hovered', function (e, data) {
    that.content_group.selectAll('.cell_' + data.cell).classed('hover', data.active);
    //that.cell_selectors_group.selectAll('.cell_' + data.cell).classed('hover', data.active);
    //that.result_cells_group.selectAll('.cell_' + data.cell).classed('hover', data.active);
    //that.mini_range_preview.selectAll('.cell_' + data.cell).classed('hover', data.active);
  });

  eventHandler.bind('result_cell_hovered', function (e, data) {
    //return;
    var hm_id = CELL_COUNT_HM_ID;
    var use_bias = that.cummulative_heatmap_for_selected_cells.length > 0;

    if (data.active && !_.includes(that.selected_cells_in_results, data.cell)) {
      var cell_index = _.indexOf(that.results.cells, data.cell);
      var hm_data = that.results.states.map(function (d, x) {
        return d.data[cell_index].map(function (dd, y) {
          return (use_bias ? that.cummulative_heatmap_for_selected_cells[x][y] : 0)
            + (dd >= that.current.selection.threshold ? 1 : 0);
        })
      });


      that.set_cell_count_hm(hm_data);
      //that.heatmaps[hm_id].updateData(hm_data, null, {});
      //that.heatmaps[hm_id].draw();


    }
    else if (use_bias) {

      that.set_cell_count_hm(that.cummulative_heatmap_for_selected_cells);
      //that.heatmaps[hm_id].updateData(that.cummulative_heatmap_for_selected_cells, null, {});
      //that.heatmaps[hm_id].draw();
    }
    else {
      that.set_cell_count_hm(that.results[hm_id]);

      //that.heatmaps[hm_id].updateData(that.results[hm_id], null, {});
      //that.heatmaps[hm_id].draw();

    }
    if (that.current.heatmap.map_cell_count_opacity) that.redraw_results({
      skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });
    else that.redraw_results({
      skip_heatmap: true, skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });


  });

  eventHandler.bind('result_cell_clicked', function (e, data) {
    if (_.includes(that.selected_cells_in_results, data.cell)) {
      _.pull(that.selected_cells_in_results, data.cell)
    } else {
      that.selected_cells_in_results.push(data.cell);
    }

    // update bias for cell_count heatmap
    if (that.selected_cells_in_results.length > 0) {
      var cell_indices = that.selected_cells_in_results.map(function (d) {
        return _.indexOf(that.results.cells, d);
      });


      that.cummulative_heatmap_for_selected_cells = that.results.states.map(function (d) {
        return d.data[0].map(function (_, i) {
          var sum = 0;
          cell_indices.forEach(function (cell_index) {
            sum += d.data[cell_index][i] >= that.current.selection.threshold ? 1 : 0;
          });
          return sum;
        })
      });


      that.set_cell_count_hm(that.cummulative_heatmap_for_selected_cells);

      //that.heatmaps[hm_id].updateData(that.cummulative_heatmap_for_selected_cells, null, {});
      //that.heatmaps[hm_id].draw();

    } else {
      that.cummulative_heatmap_for_selected_cells = [];
      that.set_cell_count_hm(that.results[CELL_COUNT_HM_ID]);

      //that.heatmaps[hm_id].updateData(that.results[hm_id], null, {});
      //that.heatmaps[hm_id].draw();
    }

    if (that.current.heatmap.map_cell_count_opacity) that.redraw_results({
      skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });
    else that.redraw_results({
      skip_heatmap: true, skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });

    //if (that.heatmap_mapped_rect == hm_id) {
    //  that.redraw_results({skip_heatmap: true, skip_words: true, skip_selectors: true, no_transition: true});
    //}

    that.result_cells_group.selectAll(".cell_selector").classed('selected', function (d) {
      return _.includes(that.selected_cells_in_results, d);
    })

  });


  /*==============
   Query events
   ================ */

  eventHandler.bind('open_query', function () {

    var query_cells = _.difference(that.selected_cells_for_query, that.current.selection.excluded_cells);

    var parameter = [
      'length=' + (that.current.brush_extent[1] - that.current.brush_extent[0]),
      'cells=' + query_cells.join(','),
      'e_left=1', 'e_right=0',
      //'c_left=' + 5,//(that.current.brush_extent[0] -1),
      //'c_right=' + 5,
      'threshold=' + that.current.selection.threshold,
      'data_set=' + (that.options.data_set),
      'data_transform=' + (that.source_info.transform)
    ];

    if (that.current.source != null) {
      parameter.push('source=' + that.current.source)
    }

    if (that.current.selection.phrase_length) {
      parameter.push('phrase_length=' + that.current.selection.phrase_length)
    }


    that.eventHandler.trigger('replace_url', {queried: true});

    var query = url + '/api/closest_sequences?' + parameter.join('&');

    that.result_view_group.style({
      opacity: .2
    });
    $.ajax(query, {
      dataType: 'json',
      success: function (index_query) {

        var all_pos = index_query.data.map(function (d) {return d[0]});
        if (all_pos.length > 0) {
          var dimensions = ['states,words,cell_count'];
          Object.keys(globalInfo['info']['meta']).forEach(function (d) {dimensions.push('meta_' + d)});

          $.ajax(
            url + '/api/context/?pos=' + all_pos.join(',')
            + '&dimensions=' + dimensions.join(',')
            + '&threshold=' + that.current.selection.threshold
            + '&cells=' + query_cells.join(',')
            + '&left=' + that.left_context
            + '&right=' + (that.right_context)
            + '&data_set=' + (that.options.data_set)
            + (that.current.source ? '&source=' + that.current.source : ''
            + '&data_transform='+(that.source_info.transform))

            , {
              dataType: 'json',
              success: function (data) {
                that.results = data;

                that.results.index_query = index_query;

                that.selected_cells_in_results = [];

                that.cummulative_heatmap_for_selected_cells = [];
                that.set_cell_count_hm(that.results[CELL_COUNT_HM_ID]);

                that.redraw_results({});


                that.result_view_group.transition().style({
                  opacity: 1
                })

              }
            });
        }
        else {
          //that.result_view_group.append('text').text('NO RESULTS');
        }
      }
    })


  })


}
;

PatternFinderVis.prototype.init_groups = function () {

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

  that.query_button_group = this.content_group.append('g').attr({
    class: 'query_button_group',
    "transform": "translate(" + that.layout.query_buttons.x + "," + that.layout.query_buttons.y + ")"
  });

  that.result_cells_group = this.content_group.append('g').attr({
    class: 'result_cells_group',
    "transform": "translate(" + that.layout.result_cells.x + "," + that.layout.result_cells.y + ")"
  });


  that.result_view_group = this.content_group.append('g').attr({
    class: 'result_view_group',
    "transform": "translate(" + that.layout.result_view.x + "," + that.layout.result_view.y + ")"
  });

  that.result_view_group_bg = this.result_view_group.append('g').attr({
    class: 'result_view_group_bg bg',
    opacity: .5
  });

  that.result_histogram = this.content_group.append('g').attr({
    class: 'result_histogram',
    "transform": "translate(" + that.layout.result_histogram.x + "," + that.layout.result_histogram.y + ")"
  });
  that.result_histogram.append('text').attr({
    class: 'result_histogram_name',
    x: -3,
    y: 12
  }).text('length dist:')

};

PatternFinderVis.prototype.init_gui = function () {
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

  //createButton(that.query_button_group,
  //  0, 0,
  //  that.layout.query_buttons.cw, that.layout.query_buttons.h,
  //  'exact_query', 'query exact length',
  //  function () {that.eventHandler.trigger('exact_query')}
  //);


  createButton(that.query_button_group,
    0, 0, //that.layout.query_buttons.cw + 5
    that.layout.query_buttons.cw, that.layout.query_buttons.h,
    'open_query', 'query open end',
    function () {
      that.current.selection.phrase_length = null;
      that.eventHandler.trigger('open_query')
    }
  );

  createButton(that.content_group,
    that.layout.low_pass_button.x, that.layout.low_pass_button.y, //that.layout.query_buttons.cw + 5
    that.layout.low_pass_button.w, that.layout.low_pass_button.h,
    'low_pass_filter', 'low pass filter',
    function () {that.eventHandler.trigger('low_pass_filter')}
  );


  function createSelectorButton(parent, x, y, width, height, classes, text, value, onFunction) {
    var qButtonG = parent.append('g').attr({
      class: classes + ' svg_select_button',
      "transform": "translate(" + x + "," + y + ")"
    });

    qButtonG.append('text').attr({
      class: 'selector',
      x: width,
      y: Math.floor(height / 2 + 7)
    }).style({
      'text-anchor': 'end'
    }).text(function () {return value ? '\uf046' : '\uf096'}).on({
      'click': onFunction
    });

    qButtonG.append('text').attr({
      class: 'label_text',
      x: width - 18,
      y: Math.floor(height / 2 + 5)
    }).style({
      'text-anchor': 'end'
    }).text(text)

  }


  //createSelectorButton(that.query_button_group,
  //  that.layout.query_buttons.cw + 5, 0, //that.layout.query_buttons.cw + 5
  //  that.layout.query_buttons.cw, that.layout.query_buttons.h,
  //  'map_opacity', 'map opacity', that.current.heatmap.map_cell_count_opacity,
  //  function () {that.eventHandler.trigger('map_opacity')});


  // navigation buttons
  that.content_group.append('text').attr({
    class: 'navigation_button',
    "transform": "translate(" + that.layout.navigation_buttons.x + "," + (that.layout.navigation_buttons.y) + ")"
  }).text(function () {
    return '\uf190';
  }).on({
    click: function () {
      that.eventHandler.trigger('navigate', -5);
    }
  });
  that.content_group.append('text').attr({
    class: 'navigation_button',
    "transform": "translate(" + (that.layout.navigation_buttons.x + 25) + "," + (that.layout.navigation_buttons.y) + ")"
  }).text(function () {
    return '\uf18e';
  }).on({
    click: function () {
      that.eventHandler.trigger('navigate', +5);
    }
  })


};

PatternFinderVis.prototype.draw_low_pass_slider = function () {
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


};

PatternFinderVis.prototype.draw_word_slider = function () {
  var that = this;

  var brush = d3.svg.brush()
    .x(that.brushScale)
    .on("brush", brushed);


  var brushArea = that.label_group.selectAll(".brushArea").data([1]);
  brushArea.exit().remove();

  // --- adding Element to class brushArea
  var brushAreaEnter = brushArea.enter().append("g").attr({
    "class": "brushArea brush"
  });

  brushAreaEnter.call(brush);
  brushAreaEnter.selectAll('rect').attr({
    height: 15
  });


  if (that.current.brush_extent[0] != that.current.brush_extent[1]) {
    brushArea.call(brush.extent([
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
    var extent0 = brush.extent(),
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


    d3.select(this).call(brush.extent(extent1));

    that.eventHandler.trigger('brush_extent', {value: extent1})

  }


};

PatternFinderVis.prototype.draw_zero_slider = function () {
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
    .data([that.current.brush_extent], function (d) {return d[0] + '_' + d[1]});
  ov_rect.exit().remove();

  ov_rect.enter().append('rect').attr({
    height: 15
  });


  ov_rect.attr({
    x: function (d) {
      return that.brushScale(d[0])
    },
    width: function (d) {return that.brushScale(d[1]) - that.brushScale(d[0])}
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


};

PatternFinderVis.prototype.data_wrangling = function (data) {
  var that = this;
  that.data = data;
  //that.data.cell_states = data.cell_states.map(function (d, i) {return d.map(Math.abs)});

  var l = data.states[0].right - data.states[0].left + 1;

  that.xScale.domain([0, l - 1]).range([that.layout.cell_width / 2, l * that.layout.cell_width - that.layout.cell_width / 2]);
  that.brushScale.domain([0, l]).range([0, l * that.layout.cell_width]);
  that.line_opacity = .5 / (Math.log(l + 1) + 1);


  var cell_id_mapper = _.identity;
  if (that.data.cells.length > 0) {
    cell_id_mapper = function (d) {return that.data.cells[d]};
  }

  that.data.draw_data = that.data.states[0].data.map(function (d, i) {
    return {index: cell_id_mapper(i), values: d};
  });

  //// clear variables:
  //that.selected_cells_by_threshold = [];
  //that.selected_cells_for_query = [];


};

PatternFinderVis.prototype.query_context = function (position, data_set, source, rle) {
  var that = this;

  var closestQuery = url + "/api/context/?pos=" + position
    + '&data_set=' + data_set
    + '&left=20&right=20&dimensions=states,cell_count,words'
    + '&data_transform='+(that.source_info.transform)
    + "&threshold="+(that.current.selection.threshold);
  if (source) {
    closestQuery += '&source=' + source
  }
  if (rle){
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

PatternFinderVis.prototype.redraw_results = function (options) {

  options = options || {};
  var background_rect;
  var that = this;

  function update_hms() {
    var x_offset = that.xScale(that.left_context + 1 + that.right_context) + 10;
    var cell_width = 10;
    var cell_height = that.layout.result_view.ch;
    var heatmap_padding = (that.left_context + 1 + that.right_context) * cell_width + 15;

    /*
     * Cell Count is special
     * */


    if (CELL_COUNT_HM_ID in that.heatmaps) {
      that.heatmaps[CELL_COUNT_HM_ID].updateData(that.cell_count_hm_data, null, {});
      that.heatmaps[CELL_COUNT_HM_ID].draw();
    } else {
      var hm_options = {
        cellWidth: cell_width,
        cellHeight: cell_height,
        title: 'cell count',
        id: CELL_COUNT_HM_ID

      };
      var hm = new HeatMap(
        that.result_view_group.node(),
        that.cell_count_hm_data, null,
        0 + x_offset, 0,
        hm_options);
      hm.bindEvents(event_handler);
      hm.draw();
      that.heatmaps[CELL_COUNT_HM_ID] = hm;
    }


    if (!options.skip_heatmap) {
      var draw_options = {
        opacity: []
      };
      if (that.current.heatmap.map_cell_count_opacity) {
        draw_options.opacity = that.opacity_map;
      }

      that.heatmap_ids.forEach(function (hm_id, i) {
        if (hm_id in that.heatmaps) {
          if (!options.skip_hm_data_update) that.heatmaps[hm_id].updateData(that.results[hm_id], null, {});
          that.heatmaps[hm_id].draw(draw_options);

        } else {
          var hm_options = {
            cellWidth: cell_width,
            cellHeight: cell_height,
            title: hm_id,
            id: hm_id

          };

          if (hm_id.startsWith('meta_')) {
            hm_options.colorScale = globalInfo['info']['meta'][hm_id.substring(5)].vis.color_scale;
            hm_options.noAutoColorScale = true;
          }


          var hm = new HeatMap(
            that.result_view_group.node(),
            that.results[hm_id], null,
            (i + 1) * heatmap_padding + x_offset, 0,
            hm_options);
          hm.bindEvents(event_handler);
          hm.draw(draw_options);
          that.heatmaps[hm_id] = hm;
        }
      })
    }

  }

  update_hms(); // has to happen before update_bg_rects !!!

  function update_bg_rects() {
    var rect_hm = that.heatmaps[that.current.heatmap.rect_selection];
    var hm_data = [];
    if (rect_hm) {
      hm_data = rect_hm.data;
    } else {
      // fake a heatmap
      hm_data = that.results.words.map(function (d, x) {
        return d.words.map(function (_, y) {
          return {x: x, y: y}
        })
      });
      hm_data = _.flatten(hm_data);
    }

    background_rect = that.result_view_group_bg.selectAll(".background_rect")
      .data(hm_data);
    background_rect.exit().remove();

    // --- adding Element to class background_rect
    background_rect.enter().append("rect").attr({
      width: that.layout.cell_width - 1,
      height: that.layout.result_view.ch - 2
    }).style({
      fill: 'white'
    });

    background_rect.attr({
      "class": function (d) {return "background_rect x" + d.x + '_y' + d.y},
      x: function (d) {return that.xScale(d.y) + (d.y >= that.left_context ? 5 : 0) - that.layout.cell_width / 2},
      y: function (d) {return d.x * that.layout.result_view.ch}
    });

    if (options.no_transition) {
      background_rect.style({
        fill: function (d) {return rect_hm ? rect_hm.colorScale(d.value) : 'white';}
      });
    } else {
      background_rect.transition().style({
        fill: function (d) {return rect_hm ? rect_hm.colorScale(d.value) : 'white';}
      });
    }


    background_rect.on({
      'mouseover': function (d) {
        that.eventHandler.trigger('heatmap_item_hovered', {x: d.x, y: d.y, active: true});
      },
      'mouseout': function (d) {
        that.eventHandler.trigger('heatmap_item_hovered', {x: d.x, y: d.y, active: false});
      }
    });
  }

  update_bg_rects();


  function update_words() {
    var result_group = that.result_view_group.selectAll(".result_group").data(that.results.words);
    result_group.exit().remove();

    // --- adding Element to class result_group
    result_group.enter().append("g").attr({
      "class": "result_group"
    });

    // --- changing nodes for result_group
    result_group.attr({
      "transform": function (d, i) {return "translate(" + 0 + "," + (i * that.layout.result_view.ch) + ")";}
    });

    var words = result_group.selectAll('.word').data(function (d) {

      //x[0] = d.index + '-' + x[0];
      return d.words;
    });

    words.enter().append('text').attr({
      class: "word"


      //x: function (d, i) {return that.xScale(i)},
      //y: that.layout.result_view.ch - 4
    });
    words.attr({
      transform: function (d, i) {
        that.text_length_tester.text(d);
        var tl = that.text_length_tester[0][0].getComputedTextLength();


        if (tl > (that.layout.cell_width - 3)) {
          return "translate(" + (that.brushScale(i) + (i >= that.left_context ? 5 : 0)) + "," + (that.layout.result_view.ch - 4) + ")scale(" + (that.layout.cell_width - 3) / tl + ",1)";
        } else {
          return "translate(" + (that.brushScale(i) + (i >= that.left_context ? 5 : 0)) + "," + (that.layout.result_view.ch - 4) + ")";
        }
      }
    }).text(function (d) {return d});
    //words.classed('query_phrase', function (d, i) {
    //  return _.inRange(i,
    //    that.left_context,
    //    that.current.brush_extent[1] - that.current.brush_extent[0] + that.left_context);
    //}).text(function (d) {return d});
  }

  if (!options.skip_words) update_words();

  function update_cell_selectors() {

    var cell_selector = that.result_cells_group.selectAll(".cell_selector").data(that.results.cells);
    cell_selector.exit().remove();

    // --- adding Element to class cell_selector
    var cell_selectorEnter = cell_selector.enter().append("g");

    cell_selectorEnter.append("rect").attr({
      "width": that.layout.cell_selectors.cw,
      "height": that.layout.cell_selectors.h
    });

    cell_selectorEnter.append("text").attr({
      y: that.layout.cell_selectors.h / 2 + 5,
      x: that.layout.cell_selectors.cw / 2

    }).style({
      'fill': 'black',
      'stroke': 'none',
      'text-anchor': 'middle',
      'font-size': '9pt',
      'pointer-events': 'none'
    });


    // --- changing nodes for cell_selector
    cell_selector.attr({
      "class": function (d) {return "cell_selector cell_" + d;},
      "transform": function (d, i) {return "translate(" + (i * that.layout.cell_selectors.cw) + "," + 0 + ")";}
    }).on({
      'mouseenter': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d, active: true});
        that.eventHandler.trigger('result_cell_hovered', {cell: d, active: true});
      },
      'mouseout': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d, active: false});
        that.eventHandler.trigger('result_cell_hovered', {cell: d, active: false});
      },
      'click': function (d) {
        that.eventHandler.trigger('result_cell_clicked', {cell: d});
      }
    });

    cell_selector.classed('selected', function (d) {
      return _.includes(that.selected_cells_in_results, d);
    });

    cell_selector.select('text').text(function (d) {return d});


  }

  if (!options.skip_selectors) update_cell_selectors();


  function update_histograms() {
    var fuzzyLengthHistogram = that.results.index_query.fuzzy_length_histogram;
    var minimal_relevant_length = 2;
    var flh_length = fuzzyLengthHistogram.length - minimal_relevant_length;
    var h_layout = that.layout.result_histogram;


    var strict_length_histogram = that.results.index_query.strict_length_histogram;

    var hScaleY = d3.scale.pow().exponent(.5).domain([0, _.max(fuzzyLengthHistogram)]).range([0, h_layout.h]);
    var hScaleX = d3.scale.ordinal().domain(_.range(0, flh_length))
      .rangeBands([0, Math.min(h_layout.cw * flh_length, h_layout.w)], .1);


    var main_layer = that.result_histogram.selectAll('.main_layer').data([0]);
    main_layer.enter().append('g').attr({class: 'main_layer'});

    var overlay_layer = that.result_histogram.selectAll('.overlay_layer').data([0]);
    overlay_layer.enter().append('g').attr({class: 'overlay_layer'}).append('text').attr({
      class: 'label_text', opacity: 0
    });


    var histogram_bg = main_layer.selectAll(".histogram_bg").data(_.range(0, flh_length));
    histogram_bg.exit().remove();
    // --- adding Element to class histogram_bg
    histogram_bg.enter().append("rect");
    // --- changing nodes for histogram_bg
    histogram_bg.attr({
      "class": "histogram_bg",
      y: 0,
      height: h_layout.h,
      x: function (d) {return hScaleX(d)},
      width: function () {return hScaleX.rangeBand()}
    }).on({
      'mouseenter': function (d) {

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
      'mouseout': function () {
        overlay_layer.selectAll('.label_text')
          .attr({
            opacity: 0
          })
      },
      'click': function (index) {
        var isSelected = d3.select(this).classed('selected');

        if (isSelected) {
          that.current.selection.phrase_length = null;
          d3.select(this).classed('selected', null);

        } else {
          that.current.selection.phrase_length = index + minimal_relevant_length;
          main_layer.selectAll(".histogram_bg").classed('selected', function (d) {return d == index;})


        }

        that.eventHandler.trigger('open_query');
      }
    });


    var histogram_fuzzy = main_layer.selectAll(".histogram_fuzzy")
      .data(_.slice(fuzzyLengthHistogram, minimal_relevant_length));
    histogram_fuzzy.exit().remove();
    // --- adding Element to class histogram_fuzzy
    histogram_fuzzy.enter().append("rect").attr({"class": "histogram_fuzzy"});
    // --- changing nodes for histogram_fuzzy
    histogram_fuzzy.attr({
      y: function (d) {return that.layout.result_histogram.h - hScaleY(d)},
      height: function (d) {return hScaleY(d) + 1},
      x: function (d, i) {return hScaleX(i)},
      width: function () {return hScaleX.rangeBand()}
    });


    var histogram_strict = main_layer.selectAll(".histogram_strict")
      .data(_.slice(strict_length_histogram, minimal_relevant_length));
    histogram_strict.exit().remove();
    // --- adding Element to class histogram_strict
    histogram_strict.enter().append("rect").attr({"class": "histogram_strict"});
    // --- changing nodes for histogram_strict
    histogram_strict.attr({
      y: function (d) {return that.layout.result_histogram.h - hScaleY(d)},
      height: function (d) {return hScaleY(d)},
      x: function (d, i) {return hScaleX(i)},
      width: function () {return hScaleX.rangeBand()}
    });


  }

  // only update histogram iff new query, length limitaions are local changes
  if (that.current.selection.phrase_length == null)update_histograms();


  var separator_line = that.result_view_group.selectAll(".separator_line").data([that.left_context]);
  separator_line.exit().remove();

  // --- adding Element to class separator_line
  separator_line.enter().append("line").attr({"class": "separator_line"});

  // --- changing nodes for separator_line
  separator_line.attr({
    x1: function (d) {return that.brushScale(d) + 2},
    x2: function (d) {return that.brushScale(d) + 2},
    y1: 0,
    y2: that.layout.result_view.ch * 50
  });


};


PatternFinderVis.prototype.redraw = function () {
  var that = this;

  // if cell order is modified by sub-set queries assign the right cell ids
  // if all cells returned then all IDs should be index position in array
  var draw_data = that.data.draw_data;

  function update_pc_lines() {
    if (that.pc_plots.length < 1) {
      var primary_pc_plot = new PCPlot(that.content_group.node(), that.layout.pc.x, that.layout.pc.y,
        {threshold: that.current.selection.threshold},
        {
          xScale: that.xScale,
          yScale: that.yScale,
          hover_event_name: 'cell_hovered',
          word_brush_scale: that.brushScale
        });
      primary_pc_plot.bind_event_handler(that.eventHandler);
      that.pc_plots.push(primary_pc_plot)
    }

    that.pc_plots[0].update(
      {
        draw_data: draw_data,
        threshold: that.current.selection.threshold,
        selected_cells: that.selected_cells_for_query,
        excluded_cells: that.current.selection.excluded_cells,
        active_brush_selection: that.current.brush_extent[0] == that.current.brush_extent[1],
        brush: that.current.brush_extent
      },
      {yScale: that.yScale});

    that.pc_plots[0].redraw();


  }

  update_pc_lines();


  var selected_cell_data = draw_data.filter(function (d) {return _.includes(that.selected_cells_for_query, d.index)});
  var discretized_cell_data = selected_cell_data.map(function (d) {
    var v = d.values.map(function (x) {return x >= that.current.selection.threshold ? 1 : 0});
    return {index: d.index, values: v}

  });

  function update_mini_preview() {
    var discrete_scale = d3.scale.linear().domain([0, that.selected_cells_for_query.length]).range([that.layout.mini_preview.h, 0]);

    //var discrete_line = d3.svg.line()
    //  .x(function (d, i) {return that.xScale(i)})
    //  .y(function (d) {return discrete_scale(d);})
    //.interpolate('step-before');

    var discrete_line = d3.svg.area()
      .x(function (d, i) {return that.brushScale(i)})
      .y0(function (d) {return discrete_scale(d);})
      .y1(that.layout.mini_preview.h)
      .interpolate('step-after');


    var aggregated_data = [];
    if (selected_cell_data.length > 0) {

      var agg_data = discretized_cell_data.filter(function (d) {return !_.includes(that.current.selection.excluded_cells, d.index)});
      aggregated_data = selected_cell_data[0].values.map(function (nothing, x_index) {
        return _.sum(agg_data.map(function (d) {return d.values[x_index]}));
        //return _.sum(selected_cell_data.map(function (d) {return d.values[x_index] >= that.threshold ? 1 : 0}))
      });

      aggregated_data = [aggregated_data]

    }

    var pc_line_discrete = that.mini_preview.selectAll(".pc_area_discrete").data(aggregated_data);
    pc_line_discrete.exit().remove();

    // --- adding Element to class pc_line_discrete
    pc_line_discrete.enter().append("path").attr({
      "class": "pc_area_discrete"
    });

    // --- changing nodes for pc_line_discrete
    pc_line_discrete.attr({
      d: discrete_line
    });


  }

  update_mini_preview();


  function update_mini_range_preview() {
    var start_brush = that.current.brush_extent[0];


    var cell_length_lines = discretized_cell_data.map(function (cell) {
      var res = [];
      var last_index = -1;
      var q_range = [];
      cell.values.forEach(function (c_value, c_index) {
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


    //cell_length_lines = _.sortBy(cell_length_lines, function (d, i) {
    //  return d.q_range[0] //[d.q_range[0], -d.q_range[1]]
    //});

    cell_length_lines.sort(function (a, b) {
      var res = a.sort_1 - b.sort_1;
      if (res == 0) {
        res = b.sort_2 - a.sort_2
      }

      return res;
    });

    cell_length_lines = _.slice(cell_length_lines, 0, 21);

    var cell_length_line_group = that.mini_range_preview.selectAll(".cell_length_line_group")
      .data(cell_length_lines, function (d) {return d.index});
    cell_length_line_group.exit().remove();

    // --- adding Element to class cell_length_line_group
    cell_length_line_group.enter().append("g").attr({
      "class": "cell_length_line_group"
    });

    // --- changing nodes for cell_length_line_group
    cell_length_line_group.attr({
      "transform": function (d, i) {return "translate(0," + (i * 5) + ")";}
    });

    var cell_length_line = cell_length_line_group.selectAll(".cell_length_line").data(function (d) {
      return d.values;
    });
    cell_length_line.exit().remove();

    // --- adding Element to class cell_length_line
    cell_length_line.enter().append("line").attr({
      "class": function (d) {
        return "cell_length_line cell_" + d.index
          + (_.includes(that.current.selection.excluded_cells, d.index) ? ' deselected' : '')
      }
    });

    // --- changing nodes for cell_length_line
    cell_length_line.attr({
      "class": function (d) {
        return "cell_length_line cell_" + d.index
          + (_.includes(that.current.selection.excluded_cells, d.index) ? ' deselected' : '')
      },
      x1: function (d) {return that.brushScale(d.range[0])},
      x2: function (d) {return that.brushScale(d.range[1] + 1)},
      y1: 3,
      y2: 3
    }).on({
      'mouseenter': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d.index, active: true})
      },
      'mouseout': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d.index, active: false})
      },
      'click': function (d) {
        that.eventHandler.trigger('cell_clicked', d.index);
      }
    });



  }

  update_mini_range_preview();


  function update_cell_selectors() {

    var cell_selector = that.cell_selectors_group.selectAll(".cell_selector").data(that.selected_cells_for_query);
    cell_selector.exit().remove();

    // --- adding Element to class cell_selector
    var cell_selectorEnter = cell_selector.enter().append("g");

    cell_selectorEnter.append("rect").attr({
      "width": that.layout.cell_selectors.cw,
      "height": that.layout.cell_selectors.h
    });

    cell_selectorEnter.append("text").attr({
      y: that.layout.cell_selectors.h / 2 + 5,
      x: that.layout.cell_selectors.cw / 2

    }).style({
      'text-anchor': 'middle',
      'font-size': '9pt',
      'pointer-events': 'none'
    });


    // --- changing nodes for cell_selector
    cell_selector.attr({
      "class": function (d) {return "cell_selector cell_" + d + (_.includes(that.current.selection.excluded_cells, d) ? '' : ' selected');},
      "transform": function (d, i) {return "translate(" + (i * that.layout.cell_selectors.cw) + "," + 0 + ")";}
    }).on({
      'mouseenter': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d, active: true})
      },
      'mouseout': function (d) {
        that.eventHandler.trigger('cell_hovered', {cell: d, active: false})
      },
      'click': function (d) {
        that.eventHandler.trigger('cell_clicked', d);
      }
    });

    cell_selector.select('text').text(function (d) {return d});


  }

  update_cell_selectors();


  function update_words() {
    var word = that.label_group.selectAll(".word").data(that.data.words[0].words);
    word.exit().remove();

    // --- adding Element to class word
    var wordEnter = word.enter().append("g").attr({
      "class": "word"
    });

    wordEnter.append('text').attr({
      class: 'noselect',
      y: 13
    });


    // --- changing nodes for word
    word.attr({
      "transform": function (d, i) {
        that.text_length_tester.text(d);
        var tl = that.text_length_tester[0][0].getComputedTextLength();


        if (tl > (that.layout.cell_width - 1)) {
          return "translate(" + that.brushScale(i) + "," + 0 + ")scale(" + (that.layout.cell_width - 1) / tl + ",1)";
        } else {
          return "translate(" + that.brushScale(i) + "," + 0 + ")";
        }

      }
    });

    word.select('text').text(function (d) {return d;});

  }

  update_words();


};


/* -- ACCESSOR FUNCTIONS --*/

PatternFinderVis.prototype.set_cell_count_hm = function (hm) {
  var that = this;

  that.cell_count_hm_data = hm;

  var max = _.max(hm.map(function (d) {return _.max(d)}));
  that.opacity_map = hm.map(function (x) {return x.map(function (y) { return 1. * y / max})})


};


