/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 6/4/16.
 */
function ResultView(parent, x, y, data, options) {
  this.parent = d3.select(parent);
  this.content_group = this.parent.append('g').attr({
    "transform": "translate(" + x + "," + y + ")"
  });

  this.event_list = {
    heatmap_item_hovered: 'heatmap_item_hovered'
  };

  //=== queries ===
  this.left_context = 2;
  this.right_context = 15;

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
    rect_selection: null
  };

  this.all_content_groups = [];
  this.create_groups();

  //=== heatmap ===
  this.heatmap_ids = Object.keys(globalInfo['info']['meta']).map(function (d) {return 'meta_' + d;});
  this.heatmaps = {};
  this.cummulative_heatmap_for_selected_cells = [];
  this.cell_count_hm_data = [];
  this.opacity_map = [];

  this.results = [];


  this.update(data, options);

  this.create_ui();
}


ResultView.prototype.update = function (data, options) {
  var that = this;

  Object.keys(data).map(function (d) {that.data[d] = data[d];});
  Object.keys(options).map(function (d) { that.options[d] = options[d];});

  that.wrangle_data();

};

ResultView.prototype.create_groups = function () {
  var that = this;

  this.result_cells_group = this.content_group.append('g').attr({
    class: 'result_cells_group',
    "transform": "translate(" + this.layout.result_cells.x + "," + this.layout.result_cells.y + ")"
  });
  this.all_content_groups.push(that.result_cells_group);

  this.result_view_group = this.content_group.append('g').attr({
    class: 'result_view_group',
    "transform": "translate(" + this.layout.result_view.x + "," + this.layout.result_view.y + ")"
  });
  this.all_content_groups.push(that.result_view_group);

  this.result_link_group = this.content_group.append('g').attr({
    class: 'result_link_group',
    "transform": "translate(" + this.layout.result_link.x + "," + this.layout.result_link.y + ")"
  });
  this.all_content_groups.push(that.result_link_group);


  this.result_view_group_bg = this.result_view_group.append('g').attr({
    class: 'result_view_group_bg bg',
    opacity: .5
  });

  this.result_histogram = this.content_group.append('g').attr({
    class: 'result_histogram',
    "transform": "translate(" + this.layout.result_histogram.x + "," + this.layout.result_histogram.y + ")"
  });
  this.result_histogram.append('text').attr({
    class: 'result_histogram_name',
    x: -3,
    y: 12
  }).text('length dist:');
  this.all_content_groups.push(that.result_histogram);


}

ResultView.prototype.wrangle_data = function () {
};

ResultView.prototype.create_ui = function () {
  var that = this;
  var dt = that.data;

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
    that.layout.query_buttons.x, that.layout.query_buttons.y,
    that.layout.query_buttons.cw, that.layout.query_buttons.h,
    'open_query', 'query open end',
    function () {
      dt.phrase_length = null;
      that.event_handler.trigger('open_query')
    }
  );
};


ResultView.prototype.redraw = function (draw_options_) {
  var options = draw_options_ || {};
  var that = this;
  var op = that.options;
  var dt = that.data;

  var background_rect;

  function update_hms() {
    var x_offset = op.xScale(that.left_context + 1 + that.right_context) + 10;
    var cell_width = 10;
    var cell_height = that.layout.ch;
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
      hm.bindEvents(that.event_handler);
      hm.draw();
      that.heatmaps[CELL_COUNT_HM_ID] = hm;
    }


    if (!options.skip_heatmap) {
      var draw_options = {
        opacity: []
      };

      // todo: default option to map cell count to opacity
      draw_options.opacity = that.opacity_map;

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
            // TODO: get rid of globalInfo
            hm_options.colorScale = globalInfo['info']['meta'][hm_id.substring(5)].vis.color_scale;
            hm_options.noAutoColorScale = true;
          }


          var hm = new HeatMap(
            that.result_view_group.node(),
            that.results[hm_id], null,
            (i + 1) * heatmap_padding + x_offset, 0,
            hm_options);
          hm.bindEvents(that.event_handler);
          hm.draw(draw_options);
          that.heatmaps[hm_id] = hm;
        }
      })
    }

  }

  update_hms(); // has to happen before update_bg_rects !!!

  function update_bg_rects() {
    var rect_hm = that.heatmaps[that.current.rect_selection];
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
      width: that.layout.cw - 1,
      height: that.layout.ch - 2
    }).style({
      fill: 'white'
    });

    background_rect.attr({
      "class": function (d) {return "background_rect x" + d.x + '_y' + d.y},
      x: function (d) {return op.xScale(d.y) + (d.y >= that.left_context ? 5 : 0) },
      y: function (d) {return d.x * that.layout.ch}
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
        that.event_handler.trigger(that.event_list.heatmap_item_hovered, {x: d.x, y: d.y, active: true});
      },
      'mouseout': function (d) {
        that.event_handler.trigger(that.event_list.heatmap_item_hovered, {x: d.x, y: d.y, active: false});
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
      "transform": function (d, i) {return "translate(" + 0 + "," + (i * that.layout.ch) + ")";}
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
        op.text_length_tester.text(d);
        var tl = op.text_length_tester[0][0].getComputedTextLength();


        if (tl > (that.layout.cw - 3)) {
          return "translate(" + (op.xScale(i) + (i >= that.left_context ? 5 : 0)) + "," + (that.layout.ch - 4) + ")scale(" + (that.layout.cw - 3) / tl + ",1)";
        } else {
          return "translate(" + (op.xScale(i) + (i >= that.left_context ? 5 : 0)) + "," + (that.layout.ch - 4) + ")";
        }
      }
    }).text(function (d) {return d});
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
        that.event_handler.trigger(Event_list.cell_hovered, {cell: d, active: true});
        that.event_handler.trigger('result_cell_hovered', {cell: d, active: true});
      },
      'mouseout': function (d) {
        that.event_handler.trigger(Event_list.cell_hovered, {cell: d, active: false});
        that.event_handler.trigger('result_cell_hovered', {cell: d, active: false});
      },
      'click': function (d) {
        that.event_handler.trigger('result_cell_clicked', {cell: d});
      }
    });

    cell_selector.classed('selected', function (d) {
      return _.includes(dt.selected_cells_in_results, d);
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
          dt.phrase_length = null;
          d3.select(this).classed('selected', null);

        } else {
          dt.phrase_length = index + minimal_relevant_length;
          main_layer.selectAll(".histogram_bg").classed('selected', function (d) {return d == index;})


        }

        that.event_handler.trigger('open_query');
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
  if (dt.phrase_length == null)update_histograms();


  var separator_line = that.result_view_group.selectAll(".separator_line").data([that.left_context]);
  separator_line.exit().remove();

  // --- adding Element to class separator_line
  separator_line.enter().append("line").attr({"class": "separator_line"});

  // --- changing nodes for separator_line
  separator_line.attr({
    x1: function (d) {return op.xScale(d) + 2},
    x2: function (d) {return op.xScale(d) + 2},
    y1: 0,
    y2: that.layout.ch * that.results.index_query.data.length
  });


  function update_links() {
    var result_link = that.result_link_group.selectAll(".result_link").data(that.results.index_query.data);
    result_link.exit().remove();

    // --- adding Element to class result_link
    var result_linkEnter = result_link.enter().append("text").attr({
      "class": "result_link navigation_button"
    });

    // --- changing nodes for result_link
    result_link.attr({
      y: function (d, i) {return (i) * that.layout.ch + 14}
    }).text("\uf0c1")
      .on('click', function (d, i) {

        that.event_handler.trigger(Event_list.new_page,
          {replace: {pos: d[0], brush: '20,' + (d[2] + 20), padding: '1,0' }}
        )

      })
    ;


  }

  update_links();


};


ResultView.prototype.set_cell_count_hm = function (hm) {
  var that = this;

  that.cell_count_hm_data = hm;

  var max = _.max(hm.map(function (d) {return _.max(d)}));
  that.opacity_map = hm.map(function (x) {return x.map(function (y) { return 1. * y / max})})


};


ResultView.prototype.bind_event_handler = function (event_handler) {
  var that = this;
  that.event_handler = event_handler;
  var dt = that.data;
  var op = that.options;

  // that.event_handler.bind('redraw', function () { that.redraw();})

  that.event_handler.bind('open_query', function () {

    var query_cells = _.difference(dt.selected_cells, dt.excluded_cells);

    var parameter = [
      'cells=' + query_cells.join(','),
      'threshold=' + dt.threshold,
      'data_set=' + (op.data_set),
      'data_transform=' + (op.source_info.transform)
    ];

    if (op.source != null) {
      parameter.push('source=' + op.source)
    }

    if (dt.phrase_length) {
      parameter.push('phrase_length=' + dt.phrase_length)
    }


    that.event_handler.trigger('replace_url', {queried: true});

    var query = op.url + '/api/closest_sequences?' + parameter.join('&');

    // that.result_view_group.style({
    //   opacity: 0
    // });
    that.all_content_groups.forEach(function (d) {d.transition().style({opacity: 0, 'pointer_events': 'none'})});

    var wt = that.content_group.selectAll('.warning_text').data(['loading...'])
    wt.enter().append('text').attr({class: 'warning_text', x: 20, y: 40});
    wt.text(function (d, i) {return d});


    $.ajax(query, {
      dataType: 'json',
      success: function (index_query) {

        console.log(index_query);
        var all_pos = index_query.data.map(function (d) {return d[0]});
        if (all_pos.length > 0) {
          var dimensions = ['states,words,cell_count'];

          that.content_group.selectAll('.warning_text').remove();
          that.all_content_groups.forEach(function (d) {d.transition().style({opacity: 1, 'pointer_events': null})});


          //Todo: global info
          Object.keys(globalInfo['info']['meta']).forEach(function (d) {dimensions.push('meta_' + d)});

          $.ajax(
            url + '/api/context/?pos=' + all_pos.join(',')
            + '&dimensions=' + dimensions.join(',')
            + '&threshold=' + dt.threshold
            + '&cells=' + query_cells.join(',')
            + '&left=' + that.left_context
            + '&right=' + (that.right_context)
            + '&data_set=' + (op.data_set)
            + (op.source ? '&source=' + op.source : ''
            + '&data_transform=' + (op.source_info.transform))

            , {
              dataType: 'json',
              success: function (data) {
                that.results = data;

                that.results.index_query = index_query;

                console.log(that.results);

                that.selected_cells_in_results = [];

                that.cummulative_heatmap_for_selected_cells = [];
                that.set_cell_count_hm(that.results[CELL_COUNT_HM_ID]);

                that.redraw({});

              }
            });
        }
        else {
          wt.text(function () {return 'no results'})
        }
      }
    })


  });


  that.event_handler.bind('result_cell_hovered', function (e, data) {
    //return;
    var hm_id = CELL_COUNT_HM_ID;
    var use_bias = that.cummulative_heatmap_for_selected_cells.length > 0;

    if (data.active && !_.includes(that.selected_cells_in_results, data.cell)) {
      var cell_index = _.indexOf(that.results.cells, data.cell);
      var hm_data = that.results.states.map(function (d, x) {
        return d.data[cell_index].map(function (dd, y) {
          return (use_bias ? that.cummulative_heatmap_for_selected_cells[x][y] : 0)
            + (dd >= dt.threshold ? 1 : 0);
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

    //TODO: mapping to opacity is default
    // if (that.current.heatmap.map_cell_count_opacity)
    that.redraw({
      skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });
    // else that.redraw({
    //   skip_heatmap: true, skip_hm_data_update: true,
    //   skip_words: true, skip_selectors: true, no_transition: true
    // });


  });

  that.event_handler.bind('result_cell_clicked', function (e, data) {
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
            sum += d.data[cell_index][i] >= dt.threshold ? 1 : 0;
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

    // if (that.current.heatmap.map_cell_count_opacity) 
    that.redraw({
      skip_hm_data_update: true,
      skip_words: true, skip_selectors: true, no_transition: true
    });
    // else that.redraw({
    //   skip_heatmap: true, skip_hm_data_update: true,
    //   skip_words: true, skip_selectors: true, no_transition: true
    // });

    //if (that.heatmap_mapped_rect == hm_id) {
    //  that.redraw_results({skip_heatmap: true, skip_words: true, skip_selectors: true, no_transition: true});
    //}

    that.result_cells_group.selectAll(".cell_selector").classed('selected', function (d) {
      return _.includes(that.selected_cells_in_results, d);
    })

  });


  /*=================
   * HEATMAP EVENTS
   ===================*/

  that.event_handler.bind('heatmap_mapping_rect_selected', function (e, hm_id) {
    that.current.rect_selection = hm_id;
    that.redraw({skip_heatmap: true, skip_words: true});
  });

  // TODO: decide if circle is still a thing
  // that.event_handler.bind('heatmap_mapping_circle_selected', function (e, hm_id) {
  //   that.current.heatmap.circle_selection = hm_id;
  //   that.redraw_results({skip_heatmap: true, skip_words: true});
  // });

  that.event_handler.bind('heatmap_item_hovered', function (e, data) {
    var hovered = that.result_view_group_bg.selectAll(".x" + data.x + "_y" + data.y);
    hovered.classed('hovered', data.active);
  });

  // that.event_handler.bind('map_opacity', function () {
  //   that.current.heatmap.map_cell_count_opacity = !that.current.heatmap.map_cell_count_opacity;
  //   that.query_button_group.selectAll('.map_opacity .selector')
  //     .text(function () {return that.current.heatmap.map_cell_count_opacity ? '\uf046' : '\uf096'});
  //
  //   that.redraw_results({
  //     skip_hm_data_update: true,
  //     skip_words: true, skip_selectors: true, no_transition: true
  //   });
  //
  //
  // });

};

ResultView.prototype.destroy = function () {
  var that = this;
  that.content_group.remove();
};