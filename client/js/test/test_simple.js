/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */
class Tester {

    static test_simple() {
        const v = d3.select('#vis');
        const sv = new SimpleComponent({parent: v, options: {}});
        console.warn(sv, SimpleComponent.events);

    }


    static test_heatmap() {
        const event_handler = $({});
        const v = d3.select('#heat');
        const sv = new HeatMap({parent: v, options: {}});
        // sv.bindEvents(event_handler);
        sv.update({
            labels: [["a", "b", "cd", "ef"],
                ["g", "h", "i", "j"]],
            values: [[10, 0, 1, 5],
                [10, -3, 10, 2]]
        });

    }

    static test_lineplot() {
        const event_handler = $({});
        const v = d3.select('#line');
        const sv = new LinePlot({parent: v, options: {}});
        sv.update({
            timeSteps: 3,
            cellValues: [
                {index: 0, values: [0.1, 0.3, 0.2]},
                {index: 1, values: [0.4, 0.6, 0.1]},
                {index: 2, values: [0.5, 0.62, 0.9]}],
            selectedCells: [2],
            deselectedCells: []
        });

        // sv.bindEvents(event_handler);
        // sv.update({
        //     // labels: [["a", "b", "cd", "ef"],
        //     //     ["g", "h", "i", "j"]],
        //     // values: [[10, 0, 1, 5],
        //     //     [10, 12, 10, 2]]
        // });

    }

}

// Tester.test_simple();
Tester.test_heatmap();
Tester.test_lineplot();


