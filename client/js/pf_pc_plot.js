/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 6/4/16.
 */
function PCPlot(parent, x, y, data, options) {
  this.parent = d3.select(parent);
  this.content_group = this.parent.append('g').attr({
    'class': PCPlot.constructor.name,
    "transform": "translate(" + x + "," + y + ")"
  });

  this.data = {
    draw_data: [],
    threshold: 0,
    selected_cells: [],
    excluded_cells: [],
    active_brush_selection: false,
    brush: []
  };
  this.options = {
    xScale: d3.scale.linear(),
    yScale: d3.scale.linear(),
    word_brush_scale: d3.scale.linear(),
    hover_event_name: 'none',
    pc_id: 0
  };
  this.current = {};

  this.update(data, options);

  this.layout = {
    threshold_slider: {
      x: 20, y: 0, w: 10
    },
    pc: {
      x: 20, y: 0
    }

  };

  // generate subgroups

  this.threshold_slider_group = this.content_group.append('g').attr({
    class: 'threshold_slider_group slider_group',
    "transform": "translate(" + this.layout.threshold_slider.x + "," + this.layout.threshold_slider.y + ")"
  });
  this.pc_group = this.content_group.append('g').attr({
    class: 'PC_plot',
    "transform": "translate(" + this.layout.pc.x + "," + this.layout.pc.y + ")"
  });

  this.pc_group_overlay = this.content_group.append('g').attr({
    class: 'PC_plot_overlay',
    "transform": "translate(" + this.layout.pc.x + "," + this.layout.pc.y + ")"
  });

  this.create_threshold_slider();

}


PCPlot.prototype.update = function (data, options) {
  var that = this;

  Object.keys(data).map(function (d) {that.data[d] = data[d];});
  Object.keys(options).map(function (d) { that.options[d] = options[d];});

  that.wrangle_data();

};


PCPlot.prototype.wrangle_data = function () {

};

PCPlot.prototype.redraw = function (draw_options) {
  // var draw_options = draw_options || {};
  var that = this;
  var op = that.options;
  var dt = that.data;
  // var current = that.current;


  var line_opacity = 1.5 / (Math.log(dt.draw_data.length + 1) + 1);

  var line = d3.svg.line()
    .x(function (d, i) {return op.xScale(i)})
    .y(function (d) {return op.yScale(d);});

  var pc_line = that.pc_group.selectAll(".pc_line")
    .data(dt.draw_data.filter(function (d) {
      return !_.includes(dt.selected_cells, d.index)
    }));
  pc_line.exit().remove();

  // --- adding Element to class pc_line
  pc_line.enter().append("path");

  // --- changing nodes for pc_line
  pc_line.attr({
    "class": function (d) {return "pc_line cell_" + d.index;},
    d: function (d) {return line(d.values);}
  }).style({
    opacity: line_opacity
  });

  that.pc_group.style({
    opacity: function () {return dt.active_brush_selection ? 1 : .7}
  });


  var pc_line_overlay = that.pc_group_overlay.selectAll(".pc_line_overlay")
    .data(dt.draw_data.filter(function (d) {
      return _.includes(dt.selected_cells, d.index)
    }));
  pc_line_overlay.exit().remove();

  // --- adding Element to class pc_line_overlay
  pc_line_overlay.enter().append("path");

  // --- changing nodes for pc_line_overlay
  pc_line_overlay.attr({
    "class": function (d) {
      return "pc_line_overlay cell_" + d.index
        + (_.includes(dt.excluded_cells, d.index) ? ' deselected' : '');
    },
    d: function (d) {return line(d.values);}
  }).on({
    'mouseenter': function (d) {
      that.event_handler.trigger(op.hover_event_name, {cell: d.index, active: true})
    },
    'mouseout': function (d) {
      that.event_handler.trigger(op.hover_event_name, {cell: d.index, active: false})
    }
  });

  var threshold_line = that.pc_group_overlay.selectAll(".threshold_line").data([dt.threshold]);
  threshold_line.exit().remove();

  // --- adding Element to class threshold_line
  threshold_line.enter().append("line").attr({
    "class": "threshold_line"
  });

  // --- changing nodes for threshold_line
  threshold_line.attr({
    x1: op.xScale(0),
    x2: op.xScale.range()[1],
    y1: function (d) {return op.yScale(d)},
    y2: function (d) {return op.yScale(d)}
  });


  var b_data = ((dt.brush.length>0 && dt.brush[0]!=dt.brush[1])?dt.brush:[]);
  var brush_indicator = that.pc_group_overlay.selectAll(".brush_indicator").data(b_data);
  brush_indicator.exit().remove();

  // --- adding Element to class brush_indicator
  brush_indicator.enter().append("line").attr({"class":"brush_indicator"});

  // --- changing nodes for brush_indicator
  brush_indicator.attr({
      x1: function(d){return op.word_brush_scale(d)},
      x2: function(d){return op.word_brush_scale(d)},
      y1: function(d){return op.yScale.range()[0]},
      y2: function(d){return op.yScale.range()[1]}
  });


};

PCPlot.prototype.create_threshold_slider = function () {
  var that = this;
  var op = that.options;
  var dt = that.data;


  var brushScale = d3.scale.linear().domain(op.yScale.domain()).range(op.yScale.range()).clamp(true);
  var ex = dt.threshold;//that.yScale(that.threshold);
  
  var brush = d3.svg.brush()
    .y(brushScale)
    .extent([ex, ex])
    .on('brush', brushed);

  var slider = that.threshold_slider_group.call(brush);
  //slider.selectAll('.extent,.resize').remove();
  slider.select(".background")
    .attr("width", that.layout.threshold_slider.w);

  var yAxis = d3.svg.axis().scale(brushScale).orient('left');
  slider.append('g').attr({
    class: 'axis',
    "transform": "translate(" + that.layout.threshold_slider.w / 2 + "," + 0 + ")"
  }).style('pointer-events', 'none').call(yAxis);

  var handle = slider.append('circle').attr({
    class: 'handle',
    "transform": "translate(" + that.layout.threshold_slider.w / 2 + "," + 0 + ")",
    "r": 5,
    "cy": brushScale(dt.threshold)
  });

  var number_format = d3.format('.3f');

  var value_text = slider.append('text').attr({
    y: -3
  }).style({
    'text-achor': 'middle'
  }).text(number_format(dt.threshold));

  function brushed() {
    var value = brush.extent()[0];

    var e = d3.event;
    if (e.sourceEvent) { // not a programmatic event
      value = brushScale.invert(d3.mouse(this)[1]);
      brush.extent([value, value]);
    }

    handle.attr("cy", brushScale(value));
    value_text.text(number_format(value));
    that.event_handler.trigger(Event_list.threshold_update, {value: value, pc_id: op.pc_id});

  }


};

PCPlot.prototype.bind_event_handler = function (event_handler) {
  var that = this;
  that.event_handler = event_handler;

  that.event_handler.bind('redraw', function () { that.redraw();})

};

PCPlot.prototype.destroy = function () {
  var that = this;
  that.content_group.remove();
};