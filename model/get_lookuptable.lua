require 'nn'
require 'rnn'
require 'nngraph'
require 'hdf5'


--[[
Reads the weights of a Lookuptable of a trained model.
In our model, this table holds the word embeddings.

Author: Sebastian Gehrmann
--]]

cmd = torch.CmdLine()
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','checkpoint/lstm_states.h5','path to output LSTM states in hdf5 format')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
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
         if torch.type(module) == "nn.LookupTable" then
            weights =  module.weight   
         else
            module:get_states()
         end
      end
   end
end

model = torch.load(opt.checkpoint_file) -- Initialize Model
model:get_states() -- Read the Table
local f = hdf5.open(opt.output_file, 'w')
f:write('weights', weights:float())
f:close()
