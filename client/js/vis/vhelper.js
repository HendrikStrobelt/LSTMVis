/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/27/17.
 */

class ColorManager {

    constructor({
      colorsZeroOne = ['#f7f7f7', '#0571b0'],
      colorsNegativeZeroOne = ['#ca0020', '#f7f7f7', '#0571b0'],
      colorsCategorical = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00",
          "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067",
          "#329262", "#5574a6", "#3b3eac"]
    }) {
        this.colorsZeroOne = colorsZeroOne;
        this.colorsNegativeZeroOne = colorsNegativeZeroOne;
        this.colorsCategorical = colorsCategorical;
        this.staticScales = new Map();
    }

    // -----
    // Create dynamic scales from data arrays
    // -----

    dynamicScalarScale(values) {
        const [min, max] = d3.extent(values);

        return this._scalarScale(min, max);
    }

    dynamicCategoricalScale(values) {
        const sortedUniqueValues = [...new Set(values)].sort();

        return this._categoricalScale(sortedUniqueValues);
    }

    // -----
    // Store and manage scales for cross-component use
    // -----

    registerCategoricalDim(key, values) {
        console.log(values, this._categoricalScale(values).range());
        this.staticScales.set(key, this._categoricalScale(values));
    }

    registerScalarDim(key, min, max) {
        this.staticScales.set(key, this._scalarScale(min, max));
    }

    removeDim(key) {
        this.staticScales.delete(key);
    }

    scaleForDim(key) {
        return this.staticScales.get(key);
    }

    reset() {
        this.staticScales.clear();
    }

    // -----
    // Scale creation methods
    // -----

    _categoricalScale(uniqueValues) {

        let allColors = [...this.colorsCategorical];

        if (allColors.length >= uniqueValues.length) {
            allColors = allColors.slice(0, uniqueValues.length);
        } else {
            // Fill with gray values
            const maxFill = uniqueValues.length - allColors.length;
            const fillScale = d3.scaleLinear().domain([0, maxFill - 1]).range(['#333', '#eee']);
            const fillArray = Array.from({length: maxFill}, (v, i) => fillScale(i));
            allColors = [...allColors, ...fillArray]
        }

        return d3.scaleOrdinal().domain(uniqueValues).range(allColors);
    }

    _scalarScale(min, max) {
        if (min * max < 0) {
            const maxAbs = -min > max ? -min : max;

            return d3.scaleLinear().domain([-maxAbs, 0, maxAbs]).range(this.colorsNegativeZeroOne);
        }

        // Else:
        return d3.scaleLinear().domain([min, max]).range(this.colorsZeroOne)
    }


}

ColorManager;

