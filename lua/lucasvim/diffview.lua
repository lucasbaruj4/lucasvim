local M = {}

local picker_namespace = vim.api.nvim_create_namespace("lucasvim_diffview_commit_picker")
local pending_label

local function git(root, args)
  return vim.fn.systemlist(vim.list_extend({ "git", "-C", root }, args))
end

local function repo_root()
  local root = git(vim.fn.getcwd(), { "rev-parse", "--show-toplevel" })[1]
  if not root or root == "" then
    vim.notify("Diffview needs a Git repository", vim.log.levels.ERROR)
    return nil
  end
  return root
end

local function add_untracked_as_intent_to_add(root)
  local paths = git(root, { "ls-files", "--others", "--exclude-standard" })
  if vim.v.shell_error ~= 0 then return end

  if #paths > 0 then
    vim.fn.system(vim.list_extend({ "git", "-C", root, "add", "-N", "--" }, paths))
  end
end

local function set_panel_header(view, label)
  vim.schedule(function()
    if not view.panel:is_open() then return end

    vim.wo[view.panel.winid].winbar = table.concat({
      "%#DiffviewFilePanelTitle#Commit: ",
      "%@v:lua.LucasvimDiffviewPickCommit@",
      label,
      "%X",
    })
  end)
end

function M.attach(view)
  local label = pending_label or "HEAD"
  pending_label = nil
  set_panel_header(view, label)
end

function M.open(rev, label)
  local root = repo_root()
  if not root then return end

  if rev then
    -- Diffview hides truly untracked files for a commit-to-working-tree diff.
    -- Intent-to-add keeps their content unstaged while making them diffable.
    add_untracked_as_intent_to_add(root)
  end

  pending_label = label or "HEAD"
  vim.cmd("DiffviewClose")

  if rev then
    vim.cmd("DiffviewOpen " .. vim.fn.fnameescape(rev))
  else
    vim.cmd("DiffviewOpen --untracked-files=all")
  end
end

function M.pick_commit()
  local root = repo_root()
  if not root then return end

  local lines = git(root, { "log", "-n", "30", "--pretty=format:%h%x09%s" })
  if vim.v.shell_error ~= 0 or #lines == 0 then
    vim.notify("Could not read Git commits", vim.log.levels.ERROR)
    return
  end

  local choices = {}
  for _, line in ipairs(lines) do
    local hash, subject = line:match("^(%S+)\t(.*)$")
    table.insert(choices, { hash = hash, subject = subject })
  end

  local buffer = vim.api.nvim_create_buf(false, true)
  local function format_choice(id, subject)
    return id .. "  │  " .. subject
  end

  local display = { "Choose comparison commit", "", format_choice("HEAD", choices[1].subject) }
  for index = 2, #choices do
    table.insert(display, format_choice(choices[index].hash, choices[index].subject))
  end
  vim.api.nvim_buf_set_lines(buffer, 0, -1, false, display)

  for index, choice in ipairs(choices) do
    local row = index + 1
    local id = index == 1 and "HEAD" or choice.hash
    local separator_start = #id + 2

    vim.api.nvim_buf_add_highlight(buffer, picker_namespace,
      index == 1 and "DiffviewFilePanelTitle" or "DiffviewStatusModified", row, 0, #id)
    vim.api.nvim_buf_add_highlight(buffer, picker_namespace, "Comment", row,
      separator_start, separator_start + #"│")
  end

  vim.bo[buffer].modifiable = false
  vim.bo[buffer].bufhidden = "wipe"

  local width = math.min(math.max(55, vim.o.columns - 12), 100)
  local height = math.min(#display, math.max(8, vim.o.lines - 8))
  local window = vim.api.nvim_open_win(buffer, true, {
    relative = "editor",
    width = width,
    height = height,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = "minimal",
    border = "rounded",
    title = " Commit baseline ",
    title_pos = "center",
  })

  vim.api.nvim_win_set_cursor(window, { 3, 0 })

  local function close()
    if vim.api.nvim_win_is_valid(window) then vim.api.nvim_win_close(window, true) end
  end

  vim.keymap.set("n", "<cr>", function()
    local line = vim.api.nvim_win_get_cursor(window)[1]
    if line < 3 or line > #display then return end

    local choice = choices[line - 2]
    close()
    if line == 3 then
      M.open(nil, "HEAD")
    else
      M.open(choice.hash, choice.hash)
    end
  end, { buffer = buffer, silent = true })
  vim.keymap.set("n", "q", close, { buffer = buffer, silent = true })
  vim.keymap.set("n", "<esc>", close, { buffer = buffer, silent = true })
end

_G.LucasvimDiffviewPickCommit = function()
  vim.schedule(M.pick_commit)
end

return M
