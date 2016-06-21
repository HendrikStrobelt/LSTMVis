require 'nn'
require 'rnn'
require 'nngraph'
require 'hdf5'

--[[
Reads the weights of a linear layer of a trained model.
The standard value points to the last linear layer of our model.

Author: Sebastian Gehrmann
--]]


cmd = torch.CmdLine()
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','checkpoint/lstm_states.h5','path to output LSTM states in hdf5 format')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')

cmd:option('-layer_index',7,'The index of the embedding layer in the model.')

opt = cmd:parse(arg)

if opt.gpuid >= 0 then
   print('using CUDA on GPU ' .. opt.gpuid .. '...')
   require 'cutorch'
   require 'cunn'
   cutorch.setDevice(opt.gpuid + 1)
end

--Function to recursively search through the model to find the desired layer.
Module = nn.Module
function Module:get_states()
   if self.modules then
      for i,module in ipairs(self.modules) do
         if torch.type(module) == "nn.Linear" then
            print("found the table")
            print(torch.type(module.weight))
            weights = module.weight   
         else
            module:get_states()
         end
      end
   end
end

model = torch.load(opt.checkpoint_file) -- Initialize Model
print(model) -- Check, if the matrix index is correct here!
model:get(opt.layer_index):get_states() -- Read the Table
local f = hdf5.open(opt.output_file, 'w')
f:write('weights', weights:float())
f:close()
