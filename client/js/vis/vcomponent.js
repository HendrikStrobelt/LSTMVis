/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */

class VComponent {

    /**
     * The static property that contains all class related events.
     * Should be overwritten and event strings have to be unique!!
     * @returns {{}} an key-value object for object to string
     */
    static get events() {
        console.error('static get events() --  not implemented');

        return {noEvent: 'VComponent_noEvent'}
    }

    /**
     * Should be overwritten to define the set of ALL options and their defaults
     * @private
     * @returns {{}}  an key-value object for default options
     */
    _getDefaultOptions() {
        console.error(this.constructor.name + '._getDefaultOptions() not implemented');

        return {};
    }

    /**
     * Inits the class and creates static DOM elements
     * @param {Element} parent  SVG DOM Element
     * @param {Object} options initial options
     */
    constructor({parent, options}) {
        this.parent = parent;

        const defaults = this._getDefaultOptions();
        this.options = {};
        this.id = Util.simpleUId({});
        Object.keys(defaults).forEach(key => this.options[key] = options[key] || defaults[key]);

        this._init()
    }

    /**
     * Should be overwritten to create the static DOM elements
     * @private
     * @return {*} ---
     */
    _init() {
        console.error(this.constructor.name + '._init() not implemented')
    }

    /**
     * Everytime data has changed, update is called and
     * triggers wrangling and re-rendering
     * @param {Object} data data object
     * @return {*} ---
     */
    update(data) {
        this.data = data;
        this.renderData = this._wrangle(data);
        this._render(this.renderData);
    }


    /**
     * Data wrangling method -- implement in subclass
     * @param {Object} data data
     * @returns {*} ---
     * @private
     */
    _wrangle(data) {

        return data;
    }

    /**
     * Is responsible for mapping data to DOM elements
     * @param {Object} renderData pre-processed (wrangled) data
     * @private
     * @returns {*} ---
     */
    _render(renderData) {
        console.error(this.constructor.name + '._render() not implemented', renderData)
    }


    /**
     * Updates instance options
     * @param {Object} options only the options that should be updated
     * @returns {*} ---
     */
    updateOptions({options}) {
        Object.keys(options).forEach(k => this.options[k] = options[k]);
    }

    
    subscribe(listener) {

    }


}

VComponent;
