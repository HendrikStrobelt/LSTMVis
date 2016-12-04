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
        return {noEvent:'VComponent_noEvent'}
    };

    /**
     * Should be overwritten to define the set of ALL options and their defaults
     * @private
     */
    _getDefaultOptions() {
        console.error(this.constructor.name+'._getDefaultOptions() not implemented');
        return {};
    }

    /**
     * inits the class and creates static DOM elements
     * @param parent SVG element
     * @param options
     */
    constructor({parent, options}) {
        this.parent = parent;

        const defaults = this._getDefaultOptions();
        this.options = Object.keys(defaults).map((key) => options[key] || defaults[key]);

        this._init()
    }

    /**
     * should be overwritten to create the static DOM elements
     * @private
     */
    _init() {
        console.error(this.constructor.name+'._init() not implemented')
    }

    /**
     * everytime data has changed, update is called and
     * triggers wrangling and re-rendering
     * @param data
     */
    update({data}) {
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
        // console.log(this.options, data);
        return data;
    }

    /**
     * is responsible for mapping data to DOM elements
     * @param renderData
     * @private
     */
    _render(renderData) {
        console.error(this.constructor.name+'._render() not implemented')
    }

    /**
     * updates instance options
     * @param options
     */
    updateOptions({options}) {
        Object.keys(options).forEach(k => this.options[k] = options[k]);
    }


}