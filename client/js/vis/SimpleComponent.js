/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */


class SimpleComponent extends VComponent {

    static get events() {
        return {
            textClick: 'SimpleVis_textclick'
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 30, y: 50}
        }
    }

    get layout() {
        return [
            {name: 'text', pos: {x: 0, y: 50}}
        ]
    }

    _init() {

        this.isActive = false;

        this.layers.text.append('text').text('click me').style('font-family', 'sans-serif')
          .on('click',
            () => this.eventHandler.trigger(SimpleComponent.events.textClick, 'Hi World'));
    }

    _bindLocalEvents() {
        this.eventHandler.bind(
          SimpleComponent.events.textClick, d => this.actionTextClicked(d))
    }


    actionTextClicked(d) {
        console.warn(d);
        this.layers.text.selectAll('text').style('font-weight',
          () => (this.isActive = !this.isActive) ? 700 : 300)

    }
}

SimpleComponent;
