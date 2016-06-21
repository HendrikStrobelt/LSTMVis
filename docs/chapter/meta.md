## Adding Annotations

Additional annotations for the Match View can either be provided as HDF5 containing a scalar value for each time step or as HDF5+Dict for categorical data. Including them into LSTMVis is a matter of adding a couple of lines to `lstm.yml`. 
At first, each file that is being used has to be registered:

```yaml
files: # assign files to reference name
  states: cbt_epoch10.h5 # states file
  word_ids: train.h5 # word ID file
  words: words.dict # dict files 
  pos: pos.h5 # --- NEW --- part-of-speech tag IDs for each time step
  pos_dict: pos.dict # --- NEW --- mapping of pos IDs -> part-of-speech tags 

```

### Categorical Annotations

Then add a `meta:` section at the end of `lstm.yml`:

```yaml
meta:
  part_of_speech: # name of the annotation 
    file: pos # reference to HDF5 file
    path: pos # path within HDF5 file
    vis:
      type: discrete # we have discrete values
  any_other_measure: ...
```

This configuration will interpret the values in `pos.h5` as numerical value. To make it more interesting, you can add a dictionary to convert the values into text:

```yaml
meta:
  part_of_speech: # name of the annotation 
    file: pos # reference to HDF5 file
    path: pos # path within HDF5 file
    dict: pos_dict # **NEW** use the dictionary file 
    vis:
      type: discrete # we have discrete values
      range: dict # **NEW** use the dictionary texts to map colors. [required !!]
```

**Tipp:** If you have your annotation data in a space separated `.txt` file you can use our [text conversion tool](tools.md#convert-.txt-to-.h5-and-.dict) to create the HDF5+Dict files.


### Scalar Annotations

If you have scalar values, you can easily add them as well. After registering the files as before, just add:

```yaml
meta:
  crazy_measure:
    file: crazy # reference to HDF5 file
    path: mood # path in HDF5 file
    vis:
      type: scalar # scalar values
      range: [0,1] # defines the range of values to be matched to color [min,max]

```