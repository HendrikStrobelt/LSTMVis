/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */
class VComponent {



    /**
     * inits the class and creates static DOM elements
     * @param parent SVG element
     * @param options
     */
    constructor(parent, options) {
        this.parent = parent;
        this.options = {};
        this.setOptions(options);

        this._init()
    }

    /**
     * should be overwritten to create static DOM elements
     * @private
     */
    _init() {

    }

    /**
     * everytime data has changed, update is called and
     * triggers wrangling and re-rendering
     * @param data
     */
    update(data) {
        this.data = data;
        this.renderData = this._wrangle(data);
        this._render(this.renderData);
    }

    /**
     * data wrangling method -- implement in subclass
     * @param data
     * @returns {*}
     * @private
     */
    _wrangle(data) {
        console.log(this.options, data);
        return data;
    }

    /**
     * is responsible for mapping data to DOM elements
     * @param renderData
     * @private
     */
    _render(renderData) {

    }

    /**
     * updates instance options
     * @param options
     */
    setOptions(options) {
        Object.keys(options).forEach(k => this.options[k] = options[k]);
    }


}