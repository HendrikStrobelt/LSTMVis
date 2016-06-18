/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/29/16.
 */


const CELL_COUNT_HM_ID = 'cell_count';
const LEFT_CONTEXT = 5;
const RIGHT_CONTEXT = 50;

/**
 * PatternFinder Visualization class
 *
 * @param parent - the parent node
 * @param x - x pos
 * @param y - y pos
 * @param event_handler
 * @param options - options
 * @constructor
 */
function PatternFinderVis(parent, x, y, event_handler, options) {

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
    that.selected_cells_for_query = [];
    return true; // TODO: used to be false .. but not necessary anymore
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

  eventHandler.bind('brush_extent', function (e, d) {

    that.label_group.select(".brushArea").call(that.word_brush.extent(d.value));

    // console.log(d.value,'\n-- d.value --');
    // performance shortcut
    if (_.isEqual(that.current.brush_extent, d.value)) return;

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


  /*===============
   Cell events
   ================= */

  eventHandler.bind('cell_clicked', function (e, cell_id) {


    if (_.includes(that.current.selection.excluded_cells, cell_id)) {
      _.remove(that.current.selection.excluded_cells, function (d) {return d == cell_id;})

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


};

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


  createButton(that.content_group,
    that.layout.low_pass_button.x, that.layout.low_pass_button.y, //that.layout.query_buttons.cw + 5
    that.layout.low_pass_button.w, that.layout.low_pass_button.h,
    'low_pass_filter', 'length filter',
    function () {that.eventHandler.trigger('low_pass_filter')}
  );


  createButton(that.content_group,
    that.layout.clear_sel_button.x, that.layout.clear_sel_button.y, //that.layout.query_buttons.cw + 5
    that.layout.clear_sel_button.w, that.layout.clear_sel_button.h,
    'clear_sel_button', 'clear selection',
    function () {that.eventHandler.trigger('brush_extent', {value: [0, 0]})}
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

  // that.data.draw_data = that.data.states[0].data.map(function (d, i) {
  //   return {index: cell_id_mapper(i), values: d};
  // });

  that.data.draw_data = that.data.states[0].data.map(function (d, i) {
    return {index: cell_id_mapper(i), values: d};
  }).filter(function (d) {return _.sum(d.values) != 0});
  //// clear variables:
  //that.selected_cells_by_threshold = [];
  //that.selected_cells_for_query = [];


};

PatternFinderVis.prototype.query_context = function (position, data_set, source, rle) {
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

PatternFinderVis.prototype.redraw = function () {
  var that = this;

  // if cell order is modified by sub-set queries assign the right cell ids
  // if all cells returned then all IDs should be index position in array
  var draw_data = that.data.draw_data;

  that.result_view.update({
    threshold: that.current.selection.threshold,
    selected_cells: that.selected_cells_for_query,
    excluded_cells: that.current.selection.excluded_cells
  }, {
    zero_left: that.current.zero_left,
    zero_right: that.current.zero_right
  });

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


    that.label_group.selectAll(".separator_line").data([LEFT_CONTEXT]).enter().append("line").attr({
      "class": "separator_line",
      x1: function (d) {return that.brushScale(d) - 1},
      x2: function (d) {return that.brushScale(d) - 1},
      y1: -5,
      y2: that.layout.cell_selectors.h + 5
    }).style({
      'pointer-events': 'none',
      'stroke-width': 1
    });


  }

  update_words();


};



