/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 11/30/16.
 */

class SVG {
    static translate({x, y}) {return "translate(" + x + "," + y + ")"}

    static group({parent, classes, pos}) {
        parent.append('g').attrs({
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

SVG, Util;
