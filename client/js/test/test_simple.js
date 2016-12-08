/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */
class Tester {

    static test_simple() {
        const v = d3.select('#vis');
        const sv = new SimpleComponent({parent: v, options: {}});
    }


    static test_heatmap() {

        const v = d3.select('#heat');
        const eventHandler = new SimpleEventHandler(v.node());

        for (const i of [0, 1]) {
            const sv = new HeatMap({
                parent: v,
                eventHandler,
                options: {
                    title:'HeatMap '+i,
                    pos: {x: 0, y: 40 + i * 100}
                }});
            sv.update({
                labels: [["a" + i, "b" + i, "cd", "ef"],
                    ["g", "h", "i" + i, "j"]],
                values: [[10 * i, 0, 1, 5],
                    [10, -3 * i, 10, 2]]
            });

        }

        eventHandler.bind(
          `${HeatMap.events.rectSelected} ${HeatMap.events.cellHovered}`,
          (d, e) => console.log(d, e.type)
        )

        console.log(eventHandler.getListeners());


    }

    static test_lineplot() {
        const v = d3.select('#line');
        const eventHandler = new SimpleEventHandler(v.node());

        const data = [
            {index: 0, values: [0.1, 0.3, 0.2]},
            {index: 1, values: [0.4, 0.6, 0.1]},
            {index: 2, values: [0.5, 0.62, 0.9]}
        ];

        const sv = new LinePlot({parent: v, eventHandler, options: {}});
        sv.update({
            timeSteps: 3,
            cellValues: data,
            selectedCells: [0, 1, 2],
            deselectedCells: []
        });
        sv.actionUpdateThreshold(0.1);


        eventHandler.bind(LinePlot.events.thresholdChanged, ({newValue}) => {
            const selectedCells = data.filter(d => d.values[1] >= newValue).map(d => d.index);
            sv.update({
                timeSteps: 3,
                cellValues: data,
                selectedCells,
                deselectedCells: []
           })
        })


    }

}

Tester.test_simple();
Tester.test_heatmap();
Tester.test_lineplot();


