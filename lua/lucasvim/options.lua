-- leader is space
vim.g.mapleader = " "
vim.opt.timeout = true
vim.opt.timeoutlen = 200
vim.opt.ttimeoutlen = 10

-- making sure nvim is always on the cwd of the file we opened 
vim.opt.autochdir = true


-- making sure diagnostics have rounded borders
vim.o.winborder = "double"

-- setting up the numbers
vim.o.number = true
vim.o.relativenumber = true
-- deleting the chars on the left
vim.opt.fillchars = { eob = " " }

-- neovide config  
if vim.g.neovide then
	vim.g.neovide_fullscreen = true
	vim.g.neovide_remember_windows_size = false
end
-- deactivating wrap
vim.opt.wrap = true
vim.opt.linebreak = true
vim.opt.breakindent = true

-- background to be the same as hacker terminal
vim.opt.termguicolors = true
-- Here I activate this command after the colorscheme has been set to override the background color and status line to my current terminal background.
vim.api.nvim_create_autocmd("ColorScheme", {
  callback = function()
    -- main editor background
    vim.api.nvim_set_hl(0, "Normal",      { bg = "NONE", fg = "NONE" })
    vim.api.nvim_set_hl(0, "NormalFloat", { bg = "#0a0a0a", fg = "NONE" })


    -- statusline + winbar (the gray strip in your screenshot)
    vim.api.nvim_set_hl(0, "StatusLine",   { bg = "NONE", fg = "#ffffff" })
    vim.api.nvim_set_hl(0, "StatusLineNC", { bg = "NONE", fg = "#777777" })

    vim.api.nvim_set_hl(0, "WinBar",       { bg = "#0a0a0a", fg = "#ffffff" })
    vim.api.nvim_set_hl(0, "WinBarNC",     { bg = "#0a0a0a", fg = "#777777" })
     vim.api.nvim_set_hl(0, "Pmenu",     { bg = "#0a0a0a", fg = "#ffffff" })
    vim.api.nvim_set_hl(0, "PmenuSel",  { bg = "#0a0a0a", fg = "#00ff66" })
    vim.api.nvim_set_hl(0, "PmenuSbar", { bg = "#0a0a0a" })
    vim.api.nvim_set_hl(0, "PmenuThumb",{ bg = "#1f1f1f" })
    vim.api.nvim_set_hl(0, "Visual", { bg = "#ffffff", fg = "#000000" })
    vim.api.nvim_set_hl(0, "SignColumn", {bg = "NONE", fg = "NONE"})
  end,})
-- yanks go to clipboard
vim.opt.clipboard = "unnamedplus"

-- save with leader w instead of ":w"
vim.keymap.set("n", "<leader>w", ":w<Enter>")

-- save if they were change and quit with leader q instead of ":x"
vim.keymap.set("n", "<leader>q", ":x<Enter>")
vim.keymap.set("t", "<leader>q", "<C-\\><C-n>:x<CR>")

-- Easier window navigation
vim.keymap.set("n", "<C-h>", "<C-w>h")
vim.keymap.set("n", "<C-l>", "<C-w>l")
vim.keymap.set("n", "<C-j>", "<C-w>j")
vim.keymap.set("n", "<C-k>", "<C-w>k")

-- go to the last part of the current line with leader l instead of "$"
vim.keymap.set("n", "<leader>l", "$")

-- deletes (d and D) do NOT go to clipboard
vim.keymap.set({ "n", "v" }, "d", '"_d')
vim.keymap.set({ "n", "v" }, "D", '"_D')
vim.keymap.set({ "n", "v" }, "c", '"_d')

-- disable the command-line window (q:)
vim.keymap.set("n", "q:", "<Nop>", { silent = true })
vim.keymap.set("n", "q/", "<Nop>", { silent = true })
vim.keymap.set("n", "q?", "<Nop>", { silent = true })
vim.keymap.set("c", "<C-f>", "<Nop>", { silent = true })

-- (DEPRECATED, WE NOW USE OIL.NVIM) open netrw file explorer with leader e instead of ":Explore"
vim.g.netrw_winsize = 30
vim.g.netrw_keepdir = 0
vim.g.netrw_banner = 0
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1
-- vim.keymap.set("n", "<leader>e", ":Explore<Enter>")

-- keymaps for yazi
vim.keymap.set("n", "<leader>e", "<cmd>Yazi<cr>")

local function render_markdown_with_glow()
  local buffer = vim.api.nvim_get_current_buf()
  local path = vim.api.nvim_buf_get_name(buffer)

  if vim.bo[buffer].filetype ~= "markdown" or path == "" then
    vim.notify("Glow only renders saved Markdown files", vim.log.levels.WARN)
    return
  end

  local preview_path = string.format(
    "%s/nvim-glow-preview-%d.md",
    vim.fn.expand("~"),
    vim.uv.hrtime()
  )
  vim.fn.writefile(vim.api.nvim_buf_get_lines(buffer, 0, -1, false), preview_path)

  local preview_buffer = vim.api.nvim_create_buf(false, true)
  local width = math.floor(vim.o.columns * 0.9)
  local height = math.floor(vim.o.lines * 0.9)
  local preview_window = vim.api.nvim_open_win(preview_buffer, true, {
    relative = "editor",
    width = width,
    height = height,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = "minimal",
    border = "rounded",
  })

  vim.fn.termopen({ "glow", "--pager", preview_path })
  vim.cmd("startinsert")

  vim.api.nvim_create_autocmd("TermClose", {
    buffer = preview_buffer,
    once = true,
    callback = function()
      vim.fn.delete(preview_path)
      if vim.api.nvim_win_is_valid(preview_window) then
        vim.api.nvim_win_close(preview_window, true)
      end
    end,
  })
end

vim.api.nvim_create_user_command("Glow", render_markdown_with_glow, {})
vim.keymap.set("n", "<leader>mg", "<cmd>Glow<cr>", { desc = "Render Markdown with Glow" })

-- Show all diagnostics for the current line in a floating window
vim.keymap.set("n", "<leader>cd", function()
  vim.diagnostic.open_float(0, { scope = "line" })
end, { desc = "Line diagnostics" })

