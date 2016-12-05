/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */
class Tester {

    static test_simple() {
        const v = d3.select('#vis').node();
        const sv = new SimpleComponent({parent: v, options: {}});
        console.warn(sv, SimpleComponent.events);

    }


    static test_heatmap() {
        const v = d3.select('#heat');
        let sv = new HeatMapComponent({parent: v, options: {}});
        sv.update([[10]]);
        console.warn(sv, SimpleComponent.events);

    }


}

// Tester.test_simple();
Tester.test_heatmap();


