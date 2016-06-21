require 'nn'
require 'rnn'
require 'nngraph'
require 'hdf5'

--[[
Extracts the gate values of a trained LSTM model
at each time step of a data set.

Author: Sebastian Gehrmann
--]]

cmd = torch.CmdLine()
cmd:option('-rnn_size', 650, 'size of LSTM internal state')
cmd:option('-num_layers', 2, 'number of layers in the LSTM')
cmd:option('-data_file','data/','path to data file in hdf5 format')
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

-- Construct the data set.
local data = torch.class("data")
function data:__init(data_file)
   local f = hdf5.open(data_file, 'r')
   self.target  = f:read('target'):all()
   self.target_output = f:read('target_output'):all()
   self.target_size = f:read('target_size'):all()[1]
   self.length = self.target:size(1)
   self.batchlength = self.target:size(2)
   self.seqlength = self.target:size(3)
end

function data.__index(self, idx)
   local input, target
   if type(idx) == "string" then
      return data[idx]
   elseif opt.gpuid > -1 then      
      input = self.target[idx]:transpose(1, 2):float():cuda()
      target = nn.SplitTable(2):forward(self.target_output[idx]:float():cuda())
   else
      input = self.target[idx]:transpose(1, 2):float()
      target = nn.SplitTable(2):forward(self.target_output[idx]:float())
   end
   return {input, target}
end

--Load the Data
local data = data.new(opt.data_file)
model = torch.load(opt.checkpoint_file)

k = 1 --keeps track of current layer
currentbatch = 1
all_input = {}
all_hidden = {}
all_forget = {}

count = {}
for i = 1, opt.num_layers do
   all_input[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size):zero() 
   all_hidden[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size):zero() 
   all_forget[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size):zero() 
   count[i] = 1
end

-- Function to recursively extract the gate values of the LSTM
-- The values are stored in paralleltable in the order: input, hidden, forget, output

m = 0 --only look at the second parallelTable in the model
Module = nn.Module
function Module:get_states()
   if self.modules then
      for i,module in ipairs(self.modules) do
         if torch.type(module) == "nn.FastLSTM" then
            -- print(module.i2g.output)
         elseif torch.type(module) == "nn.ParallelTable" then
         	m = m+ 1 
         	if m == 2 then
         	  	--we are now in the correct module, extract values
                all_input[k][count[k]]:copy(module.output[1][currentbatch])
                all_hidden[k][count[k]]:copy(module.output[2][currentbatch])
                all_forget[k][count[k]]:copy(module.output[3][currentbatch])
                count[k] = count[k] + 1
                k = k + 1
         		m=0
         	end
         end
         module:get_states()
      end
   end
end

-- Runs over the Data Set and computes the current gates
function eval_states(data, model)
   model:forget()
   model:evaluate()
   for b = 1, data.batchlength do
      for i = 1, data.length do
        local d = data[i]
      	local input, goal = d[1], d[2]
         for j = 1, data.seqlength do
            out = model:forward(input:narrow(1,j,1))
            k = 1
            model:get_states()
         end
      end
      print('output batch ' .. b .. ' of ' .. data.batchlength)
      currentbatch = currentbatch + 1
   end
end

eval_states(data, model)

local f = hdf5.open(opt.output_file, 'w')
for k=1, opt.num_layers do
   f:write("input" .. k, all_input[k]:float())
   f:write("hidden" .. k, all_hidden[k]:float())
   f:write("forget" .. k, all_forget[k]:float())
end
f:close()
