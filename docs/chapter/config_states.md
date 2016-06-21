## Configuration Options for States

There are several options to configure which states you want to use with LSTMVis. The `states` section in `lstm.yml` can be expressive. Consider the following configuration:

```yaml
states:
  file: states # used as default file
  types: [
  {type: state, layer: 1, path: states1}, # *1* minimal example 
  {file: states_u, type: state, layer: 2, path: states2}, # *2* different HDF5 file
  {type: state, layer: 2, path: state2, unsigned: true}, # *3* only positive
  {type: output, layer: 2, path: output2, transform: none}  # *4* no tanh
  ]
```

By default (\*1\*), each `types` declaration operates on the file defined in `states:file`, it also expects values in to be negative and positive, and **applies a `tanh` to all values** to map them to a [-1,1] range.

By adding a `file:` directive (\*2\*) you can overwrite the standard file for only this type.

The `unsigned: true` option (\*3\*) indicates that your values are only positive.

If you add `transform:none` (\*4\*) LSTMVis does not apply `tanh` to your state
values but expects them to be normalized between [-1,1] or [0,1]