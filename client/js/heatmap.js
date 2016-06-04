/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/7/16.
 */


/**
 * Create a heatmap
 * @param {object} parent - parent node as d3 selection
 * @param data
 * @param labels
 * @param pos_x
 * @param pos_y
 * @param options
 * @constructor
 */
function HeatMap(parent, data, labels, pos_x, pos_y, options) {
  var that = this;
  this.id = options.id || _.uniqueId('heatmap_');
  this.parent = parent;
  this.layout = {
    mapping_panel: {x: 0, y: -20 - 20},
    title: {x: 0, y: -20 + 12},
    main: {x: 0, y: 0}
  };

  this.opacity = options.opacity || [];

  this.showSetup = options.showSetup || false;

  this.datatype = options.datatype || 'scalar';

  this.hm = d3.select(parent).append('g').attr({
    class: 'heatmap',
    "transform": "translate(" + pos_x + "," + pos_y + ")"
  });

  var title = options.title || "heatmap";
  this.hm.append('text').attr({
    "class": 'hm-title',
    x: this.layout.title.x,
    y: this.layout.title.y
  }).text(
    title
  );
  this.cellWidth = options.cellWidth || 10;
  this.cellHeight = options.cellHeight || 15;
  this.options = options;
  this.colorScale = options.colorScale || d3.scale.linear();


  this.drawPanel();
  this.init_tooltip();
  this.updateData(data, labels, {})

}


HeatMap.prototype.updateData = function (data, labels, options) {
  var that = this;

  // update options as needed... keep old options.
  _.forEach(options, function (key, value) {
    that.options[key] = value;
  });


  if (that.options.noAutoColorScale == undefined) {
    that.max = that.options.max || _.max(_.flatten(data));
    that.min = that.options.min || _.min(_.flatten(data));

    if (that.min < 0) {
      var maxAbs = -that.min > that.max ? -that.min : that.max;
      that.colorScale = d3.scale.linear()
        .domain([maxAbs, 0, maxAbs])
        .range(['#ca0020', '#f7f7f7', '#0571b0']); //['#ca0020','#f4a582','#f7f7f7','#92c5de','#0571b0']

    } else {
      that.colorScale = d3.scale.linear()
        .domain([that.min, that.max])
        .range(['#f7f7f7', '#0571b0'])
    }

  }

  var labelFormat = d3.format(".4f");
  if (!_.isNumber(data[0][0])) labelFormat = _.identity;


  if (labels) {
    this.data = _.flatten(data.map(function (row, x) {
      return row.map(function (value, y) {
        return {value: value, label: labels[x][y], x: x, y: y}

      })
    }))

  } else {
    this.data = _.flatten(data.map(function (row, x) {
      return row.map(function (value, y) {
        return {value: value, label: labelFormat(value), x: x, y: y}
      })
    }))
  }


};


HeatMap.prototype.draw = function (options) {

  options = options || {};
  var that = this;
  var hmCell = that.hmCells.selectAll(".hmCell").data(that.data);
  hmCell.exit().remove();

  // --- adding Element to class hmCell
  hmCell.enter().append("rect");


  that.opacity = options.opacity || that.opacity;
  var has_opacity = that.opacity.length > 0;

  // --- changing nodes for hmCell
  hmCell.attr({
    "class": function (d) {
      return "hmCell x" + d.x + " y" + d.y
    },
    x: function (d) {
      return d.y * that.cellWidth
    },
    y: function (d) {
      return d.x * that.cellHeight
    },
    width: that.cellWidth,
    height: that.cellHeight
  });

  var style_hm = hmCell;
  if (options && options.transition == true) {
    style_hm = hmCell.transition().duration(1000)
  }
  style_hm.style({
    fill: function (d) {
      return that.colorScale(d.value);
    },
    opacity: function (d) {
      if (has_opacity) {
        return that.opacity[d.x][d.y] //* .8 + .2
      } else {
        return null;
      }
    }
  });
  hmCell.on({
    'mouseover': function (d) {
      that.eventHandler.trigger('heatmap_item_hovered', {x: d.x, y: d.y, active: true});
    },
    'mouseout': function (d) {
      that.eventHandler.trigger('heatmap_item_hovered', {x: d.x, y: d.y, active: false});
    }
  })


};


HeatMap.prototype.hoverCell = function (x, y, select) {
  var that = this;
  var hovered = this.hm.selectAll(".x" + x + ".y" + y);
  hovered.classed('hovered', select);

  if (select) {


    var datum = hovered.datum();
    that.tooltip.attr({
      opacity: 1,
      "transform": "translate("
      + (datum.y * that.cellWidth) + ","
      + ((datum.x + 1) * that.cellHeight + 5 + this.layout.main.y) + ")"
    });

    that.tooltip.select('text').text(datum.label);


  } else {

    that.tooltip.attr({
      opacity: 0
    })


  }

};

HeatMap.prototype.drawPanel = function () {
  var that = this;

  this.mapping_panel = this.hm.append('g').attr({
    class: 'mapping_panel',
    "transform": "translate(" + that.layout.mapping_panel.x + "," + that.layout.mapping_panel.y + ")"
  });
  this.mapping_panel.append('rect').attr({
    class: 'mapping-rect',
    x: 0,
    y: 3,
    width: 15,
    height: 10
  }).on({
    'click': function () {
      if (d3.select(this).classed('selected')) {
        that.eventHandler.trigger('heatmap_mapping_rect_selected', 'none')
      } else {
        that.eventHandler.trigger('heatmap_mapping_rect_selected', that.id)
      }

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
      if (d3.select(this).classed('selected')) {
        that.eventHandler.trigger('heatmap_mapping_circle_selected', 'none')
      } else {
        that.eventHandler.trigger('heatmap_mapping_circle_selected', that.id)
      }


    }
  });
  this.mapping_panel.append('circle').attr({
    cx: 20 + 3,
    cy: 3 + 5,
    r: 2
  });

  if (this.showSetup) {
    this.mapping_panel.append('text').attr({
      class: 'setup-icon',
      x: 40,
      y: 3 + 10
    }).on({
      'click': function () {
        that.eventHandler.trigger('hm_setup', that.id);
      }
    }).text("\uf085")


  }


};

HeatMap.prototype.init_tooltip = function () {
  this.hmCells = this.hm.append("g").attr({
    class: 'cells',
    "transform": "translate(" + this.layout.main.x + "," + this.layout.main.y + ")"
  });

  this.tooltip = this.hm
    .append("g").attr({
      class: 'hm-tooltip',
      "transform": "translate(" + 5 + "," + 50 + ")",
      opacity: 0
    });
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
};


HeatMap.prototype.bindEvents = function (handler) {
  var that = this;
  this.eventHandler = handler;
  handler.bind('draw', that.draw());
  handler.bind('heatmap_item_hovered', function (e, data) {
    that.hoverCell(data.x, data.y, data.active);
  });

  handler.bind('heatmap_mapping_rect_selected', function (e, hm_id) {
    that.hm.selectAll('.mapping-rect').classed('selected', that.id == hm_id);
  });

  handler.bind('heatmap_mapping_circle_selected', function (e, hm_id) {
    that.hm.selectAll('.mapping-circle').classed('selected', that.id == hm_id);
  });


  handler.bind('row_detail', function (e, id) {
    if (id > -1) {
      that.hm.transition().style({
        opacity: 0,
        'pointer-events': 'none'
      })
    } else {
      that.hm.transition().style({
        opacity: 1,
        'pointer-events': null
      })
    }

  })


};