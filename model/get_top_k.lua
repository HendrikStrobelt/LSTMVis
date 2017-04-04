require 'rnn'
require 'hdf5'
require 'nngraph'

--[[
Stores the top k predictions for every time step in a data set. 

Author: Sebastian Gehrmann
--]]

cmd = torch.CmdLine()

cmd:option('-data_file', 'data/', 'data directory. Should contain data.hdf5 with input data')
cmd:option('-gpuid', -1, 'which gpu to use. -1 = use CPU')
cmd:option('-checkpoint_file', 'checkpoint/', 'path to model checkpoint file in t7 format')
cmd:option('-output_file', 'reads/lstm_grads.h5', 'path to output LSTM gradients in hdf5 format')
cmd:option('-k', 5, 'top k preds')

opt = cmd:parse(arg)


-- Construct the data set.
local data = torch.class("data")
function data:__init(opt, data_file, use_chars)
    local f = hdf5.open(data_file, 'r')
    self.target = f:read('target'):all():cuda()
    print(self.target:size())
    self.use_chars = use_chars
    self.target_output = f:read('target_output'):all():cuda()
    print(self.target_output:size())
    self.target_size = f:read('target_size'):all()[1]

    self.length = self.target:size(1)
    self.seqlength = self.target:size(3)
    self.batchlength = 5--self.target:size(2)
end

function data:size()
    return self.length
end

function data.__index(self, idx)
    local input, target
    if type(idx) == "string" then
        return data[idx]
    else
        if opt.gpuid < 0 then
            input = self.target[idx]:transpose(1, 2):float()
            target = nn.SplitTable(2):forward(self.target_output[idx]:float())
        else
            input = self.target[idx]:transpose(1, 2):float():cuda()
            target = nn.SplitTable(2):forward(self.target_output[idx]:float():cuda())
        end
    end
    return { input, target }
end


function top_k(data, model)
    local all_tops, all_scores
    if opt.gpuid < 0 then
        all_tops = torch.DoubleTensor(data.length * data.batchlength * data.seqlength, opt.k)
        all_scores = torch.DoubleTensor(data.length * data.batchlength * data.seqlength, opt.k)
    else
        all_tops = torch.CudaTensor(data.length * data.batchlength * data.seqlength, opt.k)
        all_scores = torch.CudaTensor(data.length * data.batchlength * data.seqlength, opt.k)
    end

    -- model:training()
    for i = 1, data:size() do
        if i % 100 == 0 or i == 2 then
            print(i, "current batch")
        end
        -- model:forget()
        -- model:zeroGradParameters()
        local d = data[i]
        input, goal = d[1], d[2]
        -- 1. forward
        local out = model:forward(input)
        -- go over all the time steps with a sequence pointer
        for seqp = 1, #out do
            local cpred = out[seqp]
            -- 2. get top predictions
            local res, ind = cpred:topk(opt.k, true)
--            print(cpred:size())
--            print(ind:size())
            for cbatch = 1, data.batchlength do
                -- Compute index in storage file.
                -- local batchbonus = (cbatch - 1) * data.length
                -- local new_index = i + (seqp-1) + data.batchlength * (i - 1) + batchbonus
--                print(new_index)
		local new_index = seqp + (i-1) * data.seqlength + data.length * data.seqlength* (cbatch - 1)
                --print(new_index, seqp, cbatch, i)
		all_tops[new_index]:copy(ind:narrow(1, cbatch, 1))
                all_scores[new_index]:copy(res:narrow(1, cbatch, 1))
            end
        end

        collectgarbage()

    end

    local f = hdf5.open(opt.output_file, 'w')
    f:write('preds', all_tops:float())
    f:write('scores', all_scores:float())
    f:close()
end

function main()
    -- Parse input params
    opt = cmd:parse(arg)

    if opt.gpuid >= 0 then
        print('using CUDA on GPU ' .. opt.gpuid .. '...')
        require 'cutorch'
        require 'cunn'
        cutorch.setDevice(opt.gpuid + 1)
    end

    -- Create the data loader class.
    local train_data = data.new(opt, opt.data_file, opt.use_chars)
    -- Initialize Model.
    model = torch.load(opt.checkpoint_file)
    if opt.gpuid >= 0 then
        model:cuda()
    end
    top_k(train_data, model)
end

main()
