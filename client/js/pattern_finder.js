/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 4/8/16.
 */

var url_path = window.location.pathname.split('/').slice(0, -2).join('/');
var url = window.location.origin + (url_path.length ? '/' + url_path : '');

const Event_list = {
  threshold_update: 'threshold_update',
  cell_hovered: 'cell_hovered',
  new_page: 'new_page'
};


/**
 * get URL parameters
 * @param variable
 * @returns {string}
 */
function getQueryVariable(variable) {
  // from:  http://stackoverflow.com/questions/2090551/parse-query-string-in-javascript
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  console.log('Query variable %s not found', variable);
}

var url_parameters = {};

function all_query_variables_and_defaults() {
  var query = window.location.search.substring(1);
  var vars = query.split('&');

  for (var i = 0; i < vars.length; i++) {
    if (vars[i].length > 0) {
      var pair = vars[i].split('=');
      var key = decodeURIComponent(pair[0]);
      url_parameters[key] = decodeURIComponent(pair[1]);
    }
  }

  // == necessary defaults ==
  url_parameters.pos = +url_parameters.pos || 100;
  url_parameters.data_set = url_parameters.data_set || 0;

}


all_query_variables_and_defaults();

console.log(url_parameters);


function url_string(replace) {
  var res = 'pattern_finder.html';

  replace = replace || {};
  var attr = [];
  Object.keys(url_parameters).forEach(function (k) {
    var v = replace[k] || url_parameters[k];

    if (v != undefined) {
      attr.push(encodeURI(k + '=' + v))
    }
  });

  if (attr.length > 0) {
    res += '?' + attr.join('&')
  }
  return res
}


//var position = $('#pos').val() || getQueryVariable('pos') || 100;
//var mask = getQueryVariable('mask');
//var itemList = getQueryVariable('items');


var event_handler = $({});

var cat20colors = d3.scale.category20().range();
console.log('cat20', cat20colors);

var cat16colors = ["#3366cc", "#ff9900", "#109618", "#990099", "#0099c6",
  "#66aa00", "#316395", "#994499", "#22aa99", "#aaaa11",
  "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6",
  "#3b3eac"].reverse();
cat16colors = cat16colors.map(function (d) {return d3.rgb(d).brighter()});
cat16colors = _.concat(cat20colors, cat16colors)

var cat_colors = cat16colors;

const neutral_color = '#EEEEEE';
const positive_color = "#2D57B2";
const negative_color = "#F98400";


var globalInfo = {};


$('#headline').text('Pattern Finder for Position: '
  + url_parameters.pos);


var margin = {top: 0, right: 10, bottom: 20, left: 10},
  width = 2500 - margin.left - margin.right,
  height = 4000 - margin.top - margin.bottom;

var svg = d3.select("#vis").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var contextVisGroup = svg.append('g').attr({
  "transform": "translate(" + 0 + "," + 0 + ")"
});


function bindSearchButtons() {
  function search() {
    var value = $("#searchPhrase").val();
    $.ajax(url + "/api/search_words/?html=true"
      + (url_parameters.data_set ? '&data_set=' + url_parameters.data_set : '')
      + "&query=" + encodeURI(value), {
      dataType: 'json',
      success: function (data) {

        var searchResult = d3.select("#searchResults").selectAll(".searchResult").data(data, function (d) {
          return d.index
        });
        searchResult.exit().remove();

        // --- adding Element to class searchResult
        var searchResultEnter = searchResult.enter().append("tr").attr({
          "class": "searchResult"
        }).on({
          'click': function (d) {
            event_handler.trigger('new_pivot_context', {data: d})
          }
        });

        searchResultEnter.append("th").attr({
          scope: 'row'
        }).text(function (d) {
          return d.index
        });

        searchResultEnter.append("td").html(function (d) {
          return d.text
        })


      }
    })
  }

  d3.select('#searchPhraseButton').on({
    'click': function () {
      search();
    }
  });

  d3.select('#searchPhrase').on({
    'change': function () {
      search();
    }
  });


}
bindSearchButtons();

function createGlobalInformation(info) {
  globalInfo = info[url_parameters.data_set];

  $('#headline').html('Pattern Finder for <b>' + (globalInfo.info.name || globalInfo.project) + '</b>'
    + ' (' + url_parameters.pos + ')');
  //+ (url_parameters.mask ? ' (masked)' : ''));

  d3.select('#searchPhrase').attr({
    disabled: globalInfo['info'].index ? null : true
  });

  var all_states = globalInfo.info.states.types.map(function (d, i) {return d.file + '::' + d.path})
  var sources = d3.select('#sources').selectAll('option').data(all_states);
  sources.exit().remove();
  sources.enter().append('option').text(function (d, i) {return d});

  document.getElementById('sources').selectedIndex = (url_parameters.source ? all_states.indexOf(url_parameters.source) : 0);
  d3.select('#sources').on('change', function () {
    var new_source = all_states[document.getElementById('sources').selectedIndex];
    window.open(url_string({source: new_source}), '_self')

  })


  var meta = globalInfo['info']['meta'];
  console.log(globalInfo['info']['meta'], '\n-- globalInfo--');
  // create scales for meta
  _.forEach(meta, function (m) {

    var v = m.vis;
    if (v.type == 'scalar') {
      if (v.range[0] >= 0) {
        v.color_scale = d3.scale.linear().domain(v.range).range([neutral_color, positive_color])
      } else {
        v.range = [v.range[0], 0, v.range[1]];
        v.color_scale = d3.scale.linear().domain(v.range).range([negative_color, neutral_color, positive_color])
      }
    }

    if (v.type == 'discrete') {
      var l = v.range.length;

      var color_palette = _.range(0, l).map(function (d) {
        if (d < cat_colors.length) {
          return cat_colors[d];
        } else {
          return neutral_color;
        }
      });

      v.color_scale = d3.scale.ordinal().domain(v.range).range(color_palette);
    }

  })

}

function bind_events() {
  event_handler.bind('new_pivot_context', function () {
    d3.select("#searchResults").selectAll(".searchResult").remove()

  })

  event_handler.bind('replace_url', function (e, op) {

    _.keys(op).forEach(function (d) {
      url_parameters[d] = op[d];
    });

    window.history.replaceState(
      {html: 'pattern_finder.html', 'pageTitle': 'LSTMVis: Pattern Finder'}
      , "",
      url_string());

    if (globalInfo.info) {
      $('#headline').html('Pattern Finder for <b>'
        + (globalInfo.info.name || globalInfo.project) + '</b>'
        + (url_parameters.source ? ' - ' + url_parameters.source + ' - ' : '')
        + ' (' + url_parameters.pos + ')');
    }

  });

  event_handler.bind(Event_list.new_page, function (e, d) {
    window.open(url_string(d.replace));
  })

}

bind_events();
event_handler.trigger('replace_url', {});


$.ajax(url + "/api/info", {
  dataType: 'json',
  success: function (info) {

    createGlobalInformation(info);

    //var extraPar = '';
    //if (itemList) {
    //  extraPar += '&items=' + itemList;
    //  position = itemList.split(',')[0]
    //}


    var pfv = new PatternFinderVis(contextVisGroup.node(), 0, 0, event_handler, url_parameters);


    d3.selectAll('#loading').transition().style({
      opacity: 0,
      'pointer-events': 'none'
    });

    d3.selectAll('#headline,#vis').transition().style({
      opacity: 1
    });

  }
})
;
