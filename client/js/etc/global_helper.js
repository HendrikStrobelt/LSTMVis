/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 11/30/16.
 */

const svg_translate = ({x, y}) => "translate(" + x + "," + y + ")";
const svg_group = ({parent, classes, pos}) => parent.append('g').attrs({
    class: classes,
    "transform": svg_translate(pos)
});

let _the_unique_id_counter = 0;

const simpleUId = ({prefix = ''}) => prefix + _the_unique_id_counter++;


