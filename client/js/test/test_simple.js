/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */
class Tester {

    static test_simple() {
        const v = d3.select('#vis').node();
        const sv = new SimpleComponent({parent: v, options: {}});
        console.warn(sv, SimpleComponent.events);

    }


}

Tester.test_simple();


