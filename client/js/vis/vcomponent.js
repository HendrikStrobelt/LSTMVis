/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */

class VComponent {

    // STATIC FIELDS ============================================================

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
     * @returns {{}}  an key-value object for default options
     */
    get defaultOptions() {
        console.error('get defaultOptions() not implemented');

        return {
            pos: {x: 10, y: 10},
            // List of Events that are ONLY handled globally:
            globalExclusiveEvents: []
        };
    }


    get layout() {
        console.error('get layout() not implemented');

        return [{name: 'main', pos: {x: 0, y: 0}}];
    }

    // CONSTRUCTOR ============================================================


    /**
     * Inits the class and creates static DOM elements
     * @param {Element} parent  D3 selection of parent SVG DOM Element
     * @param {Element} eventHandler a global event handler object or 'null' for local event handler
     * @param {Object} options initial options
     */
    constructor({parent, eventHandler = null, options = {}}) {
        this.id = Util.simpleUId({});

        this.parent = parent;

        // Set default options if not specified in constructor call
        const defaults = this.defaultOptions;
        this.options = {};
        const keys = new Set([...Object.keys(defaults), ...Object.keys(options)])
        keys.forEach(key => this.options[key] = options[key] || defaults[key]);

        // Create the base group element
        this.base = this._createBaseElement(parent);
        this.layers = this._createLayoutLayers(this.base);

        // If not further specified - create a local event handler bound to the bas element
        this.isLocalEventHandler = !eventHandler;
        this.eventHandler = eventHandler ||
          new SimpleEventHandler(this.base.node());
        this._bindLocalEvents(this.eventHandler);

        // Object for storing internal states and variables
        this._states = {hidden: false};

        // Setup the static parts of the DOM tree
        this._init()
    }

    // CREATE BASIC ELEMENTS ============================================================

    /**
     * Creates the base element (<g>) that hosts the vis
     * @param {Element} parent the parent Element
     * @returns {*} D3 selection of the base element
     * @private
     */
    _createBaseElement(parent) {
        // Create a group element to host the visualization
        // <g> CSS Class is javascript class name in lowercase + ID
        return SVG.group(
          parent,
          this.constructor.name.toLowerCase() + ' ID' + this.id,
          this.options.pos || {x: 0, y: 0}
        );
    }

    _createLayoutLayers(base) {
        const res = {};
        for (const lE of this.layout) {
            res[lE.name] = SVG.group(base, lE.name, lE.pos);
        }

        return res;
    }


    /**
     * Should be overwritten to create the static DOM elements
     * @private
     * @return {*} ---
     */
    _init() {
        console.error(this.constructor.name + '._init() not implemented')
    }

    // DATA UPDATE & RENDER ============================================================

    /**
     * Every time data has changed, update is called and
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


    // UPDATE OPTIONS ============================================================

    /**
     * Updates instance options
     * @param {Object} options only the options that should be updated
     * @param {Boolean} reRender if option change requires a re-rendering (default:false)
     * @returns {*} ---
     */
    updateOptions({options, reRender = false}) {
        Object.keys(options).forEach(k => this.options[k] = options[k]);
        if (reRender) this._render(this.renderData);
    }

    // BIND LOCAL EVENTS ============================================================

    _bindEvent(eventHandler, name, func) {
        // Wrap in Set to handle 'undefinded' etc..
        const globalEvents = new Set(this.options.globalExclusiveEvents);
        if (!globalEvents.has(name)) {
            eventHandler.bind(name, func)
        }
    }

    _bindLocalEvents(eventHandler) {
        eventHandler;
        console.error('_bindLocalEvents() not implemented.')

    }

    hideView() {
        if (!this._states.hidden) {
            this.base.styles({
                'opacity': 0,
                'pointer-events': 'none'
            });
            this._states.hidden = true;
        }
    }

    unhideView() {
        if (this._states.hidden) {
            this.base.styles({
                'opacity': 1,
                'pointer-events': null
            });
            this._states.hidden = false;
        }
    }

    destroy() {
        this.base.remove();
    }

}

VComponent;
