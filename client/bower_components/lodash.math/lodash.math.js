(function() {

  var math = this.math = {};

  // Arithmetic mean
  // math.mean([1,2,3])
  //   => 2
  math.mean = math.ave = math.average = function(obj, key) {
    return math.sum(obj, key) / _.size(obj);
  };

  // math.median([1,2,3,4])
  //   => 2.5
  //   TODO {}, [{}]
  math.median = function(arr) {
    arr = arr.slice(0); // create copy
    var middle = (arr.length + 1) / 2,
      sorted = math.sort(arr);
    return (sorted.length % 2) ? sorted[middle - 1] : (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2;
  };

  // Power, exponent
  // math.pow(2,3)
  //   => 8
  math.pow = math.power = function(x, n) {
     if (_.isNumber(x))
        return Math.pow(x, n);
     if (_.isArray(x))
        return _.map(x, function(i) { return _.pow(i, n); });
  };

  // Round
  // math.round(12345.6789, 2)
  //   => 12345.68
  math.round = function(number, decimals) {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  // Scale to max value
  // math.scale(1,[2,5,10])
  //   => [ 0.2, 0.5, 1]
  math.scale = function(arr, max) {
    max = max || 1;
    var max0 = _.max(arr);
    return _.map(arr, function(i) { return i * (max / max0); });
  };

  // Slope between two points
  // math.slope([0,0],[1,2])
  //   => 2
  math.slope = function(x, y) {
    return (y[1] - x[1]) / (y[0] - x[0]);
  };

  // Numeric sort
  // math.sort([3,1,2])
  //   => [1,2,3]
  math.sort = function(arr) {
    return _.sortBy(arr, _.identity);
  };

   // math.stdDeviation([1,2,3])
  //   => 0.816496580927726
  math.stdDeviation = math.sigma = function(arr) {
    return Math.sqrt(_.variance(arr));
  };

  // Sum of array
  // math.sum([1,2,3])
  //   => 6
  // math.sum([{b: 4},{b: 5},{b: 6}], 'b')
  //   => 15
  math.sum = function(obj, key) {
    var arr;
    if (_.isArray(obj) && typeof obj[0] === 'number') {
      arr = obj;
    } else {
      key = key || 'value';
      arr = _.pluck(obj, key);
    }
    var val = 0, i;
    for (i = 0; i < arr.length; i++)
      val += (arr[i]-0);
    return val;
  };

  // math.transpose(([1,2,3], [4,5,6], [7,8,9]])
  //   => [[1,4,7], [2,5,8], [3,6,9]]
  math.transpose = function(arr) {
    var trans = [];
    _.each(arr, function(row, y){
      _.each(row, function(col, x){
        if (!trans[x]) trans[x] = [];
        trans[x][y] = col;
      });
    });
    return trans;
  };

  // math.variance([1,2,3])
  //   => 2/3
  math.variance = function(arr) {
    var mean = _.mean(arr),
      variance = function(x) { return _.pow( x - mean, 2); };
    return _(arr).map(variance).mean().value();
  };

  // Standard score, assuming normal distribution
  // math.zscore([1,2,3])
  //   => [-1.224744871391589, 0, 1.224744871391589]
  math.zscore = function(obj, key) {
    var arr;
    if (_.isArray(obj) && typeof obj[0] === 'number') {
      arr = obj;
    } else {
      key = key || 'value';
      arr = _.pluck(obj, key);
    }

    var mean = _.mean(arr),
        sigma = _.stdDeviation(arr),
        zscore = function(d) { return (d - mean) / sigma; };
    return _.map(arr, zscore);
  };

  // math.movingAvg([1,2,3,4,5], 3);
  //   => [2,3,4]
  math.movingAvg = math.movingAverage = function(arr, size) {
    var win, i, newarr = [];
    for(i = size-1; i <= arr.length; i++) {
      win = arr.slice(i - size, i);
      if (win.length === size) {
        newarr.push(_.mean(win));
      }
    }
    return newarr;
  };

  // add methods to Underscore.js namespace
  _.mixin(math);

})();
