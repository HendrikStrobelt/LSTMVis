/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 11/30/16.
 */

class SVG {
    static translate({x, y}) {return "translate(" + x + "," + y + ")"}

    static group(parent, classes, pos) {
        return parent.append('g').attrs({
            class: classes,
            "transform": SVG.translate(pos)
        })
    }

}

let the_unique_id_counter = 0;
class Util {
    static simpleUId({prefix = ''}) {
        the_unique_id_counter += 1;

        return prefix + the_unique_id_counter;
    }

}

class SimpleEventHandler {
    constructor(element) {
        this.element = element;
        this.eventListeners = []
    }


    bind(eventNames, eventFunction) {
        for (const eventName of eventNames.split(' ')) {
            this.eventListeners.push({eventName, eventFunction});
            const eventFunctionWrap = e => eventFunction(e.detail, e);
            this.element.addEventListener(eventName, eventFunctionWrap, false);
        }
    }

    getListeners() {
        return this.eventListeners;
    }

    trigger(eventName, detail) {
        this.element.dispatchEvent(new CustomEvent(eventName, {detail}));
    }

}


SVG, Util, SimpleEventHandler;
