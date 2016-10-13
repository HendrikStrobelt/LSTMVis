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
cmd:option('-data_file', 'data/', 'path to data file in hdf5 format')
cmd:option('-checkpoint_file', 'checkpoint/', 'path to model checkpoint file in t7 format')
cmd:option('-output_file', 'checkpoint/lstm_states.h5', 'path to output LSTM states in hdf5 format')
cmd:option('-gpuid', -1, 'which gpu to use. -1 = use CPU')
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
    self.target = f:read('target'):all()
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
    return { input, target }
end

--Load the Data
local data = data.new(opt.data_file)
model = torch.load(opt.checkpoint_file)
print(model)

k = 1 --keeps track of current layer

all_reset_no_sigmoid = {}
all_skip_no_sigmoid = {}

count = {}
for i = 1, opt.num_layers do
    all_reset_no_sigmoid[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size):zero()
    all_skip_no_sigmoid[i] = torch.FloatTensor(data.length * data.batchlength * data.seqlength, opt.rnn_size):zero()
    count[i] = 1
end

-- Function to recursively extract the gate values of the LSTM
-- The values are stored in paralleltable in the order: reset, skip

s = 0 --only look at the second and third SplitTable in the model
Module = nn.Module
function Module:get_states()
    if self.modules then
        for i, module in ipairs(self.modules) do
            if torch.type(module) == "nn.FastLSTM" then
                -- print(module.i2g.output)
            elseif torch.type(module) == "nn.SplitTable" then
                s = s + 1
                if s > 1 then
                    all_reset_no_sigmoid[k][count[k]]:copy(module.output[1])
                    all_skip_no_sigmoid[k][count[k]]:copy(module.output[2])
                    count[k] = count[k] + 1
                    k = k + 1
                    if s == 3 then
                        s = 0
                    end
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
                out = model:forward(input:narrow(1, j, 1):narrow(2, b, 1))
                k = 1
                model:get_states()

            end

        end
        print('output batch ' .. b .. ' of ' .. data.batchlength)

    end
end

eval_states(data, model)

local f = hdf5.open(opt.output_file, 'w')
for k = 1, opt.num_layers do
    f:write("reset" .. k, all_reset_no_sigmoid[k]:float())
    f:write("skip" .. k, all_skip_no_sigmoid[k]:float())
end
f:close()
