require 'nn'
require 'rnn'
require 'nngraph'
require 'hdf5'


--[[
Extracts the hidden state and output of a trained model 
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

k = 1
currentbatch = 1
Module = nn.Module
all_hidden = {}
count = {}
for i = 1, (2*opt.num_layers) do
   all_hidden[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size) 
   count[i] = 1
end

print("starting the extraction...")

-- Function to recursively extract output and hidden state of the LSTM
function Module:get_states()
   if self.modules then
      for i,module in ipairs(self.modules) do
         if torch.type(module) == "nn.FastLSTM" or torch.type(module) == "nn.GRU"then
            if module.output ~= nil then
               all_hidden[k][count[k]]:copy(module.output[currentbatch])
               count[k] = count[k] + 1
               k = k + 1
            end
            if module.cell ~= nil then
               all_hidden[k][count[k]]:copy(module.cell[currentbatch])
               count[k] = count[k] + 1
               k = k + 1
            end
         else
            module:get_states()
         end
      end
   end
end

-- Runs over the Data Set and computes the current hidden states
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

function construct_index(index) 
    string_type = ""
    if index%2 == 1 then
        string_type = "output"
    else
        string_type = "states"
    end
    string_index = math.ceil(index/2)
    return string_type .. string_index
end

eval_states(data, model)

local f = hdf5.open(opt.output_file, 'w')
for k=1, 2*opt.num_layers do
   f:write(construct_index(k), all_hidden[k]:float())
end
f:close()
