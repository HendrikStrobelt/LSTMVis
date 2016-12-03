/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */
class SimpleVis extends VComponent{

    _init(){
        console.log(this.options);
        this.mainG = d3.select(this.parent).append('g');
    }

    // Houston -- we need a new idea
    setOptions({px=10, py=100}){
        super.setOptions(arguments[0])
    }





}