/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 6/2/16.
 */

function LinePlot(parent, x, y, xScale, eventHandler, hover_event_name,  options) {
  this.parent = d3.select(parent);
  this.options = options;

  Object.keys(options).forEach(function (d) {
    console.log(d);
    this[d] = options[d];
  });

  this.xScale = xScale;
  this.eventHandler = eventHandler;
  this.hover_event_name = hover_event_name;

  this.pc_group = this.parent.append('g').attr({
    class: 'PC_plot',
    "transform": "translate(" + x + "," + y + ")"
  });

  this.pc_group_overlay = this.parent.append('g').attr({
    class: 'PC_plot_overlay',
    "transform": "translate(" + x + "," + y + ")"
  });

  console.log(this);

}


LinePlot.prototype.redraw = function (draw_data, yScale, threshold, selected_cells, excluded_cells, active_brush_selection) {
  var that = this;
  var line_opacity = 1.5 / (Math.log(draw_data.length + 1) + 1);
  console.log(line_opacity, draw_data.length,'\n-- line_opacity, draw_data.length --');
  var line = d3.svg.line()
    .x(function (d, i) {return that.xScale(i)})
    .y(function (d) {return yScale(d);});

  var pc_line = that.pc_group.selectAll(".pc_line")
    .data(draw_data.filter(function (d) {
      return !_.includes(selected_cells, d.index)
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
    opacity: function () {return active_brush_selection ? 1 : .7}
  });


  var pc_line_overlay = that.pc_group_overlay.selectAll(".pc_line_overlay")
    .data(draw_data.filter(function (d) {
      return _.includes(selected_cells, d.index)
    }));
  pc_line_overlay.exit().remove();

  // --- adding Element to class pc_line_overlay
  pc_line_overlay.enter().append("path");

  // --- changing nodes for pc_line_overlay
  pc_line_overlay.attr({
    "class": function (d) {
      return "pc_line_overlay cell_" + d.index
        + (_.includes(excluded_cells, d.index) ? ' deselected' : '');
    },
    d: function (d) {return line(d.values);}
  }).on({
    'mouseenter': function (d) {
      that.eventHandler.trigger(that.hover_event_name, {cell: d.index, active: true})
    },
    'mouseout': function (d) {
      that.eventHandler.trigger(that.hover_event_name, {cell: d.index, active: false})
    }
  });

  var threshold_line = that.pc_group_overlay.selectAll(".threshold_line").data([threshold]);
  threshold_line.exit().remove();

  // --- adding Element to class threshold_line
  threshold_line.enter().append("line").attr({
    "class": "threshold_line"
  });

  // --- changing nodes for threshold_line
  threshold_line.attr({
    x1: that.xScale(0),
    x2: that.xScale.range()[1],
    y1: function (d) {return yScale(d)},
    y2: function (d) {return yScale(d)}
  });

}

