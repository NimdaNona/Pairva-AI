#!/usr/bin/env bash
#
# bootstrap.sh — turn a stock Ubuntu 24.10 “Oracular Oriole” droplet
# into a fully-loaded dev workstation ready for snapshotting.
# Usage: sudo ./bootstrap.sh <username>
#
set -euo pipefail
IFS=$'\n\t'

################################################################################
# VARIABLES
################################################################################
NEW_USER="${1:-developer}"
ARCH="$(dpkg --print-architecture)"
CODENAME="$(lsb_release -cs)"

################################################################################
# 0.  BASIC HOUSEKEEPING & HARDENING
################################################################################
export DEBIAN_FRONTEND=noninteractive

echo ">>> Updating base OS …"
apt update && apt full-upgrade -y          # latest kernel & fixes
apt install -y unattended-upgrades fail2ban ufw software-properties-common

echo ">>> Creating non-root sudo user: $NEW_USER"
id "$NEW_USER" &>/dev/null || {
  adduser --disabled-password --gecos "" "$NEW_USER"
  echo "$NEW_USER ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/$NEW_USER
}
usermod -aG sudo "$NEW_USER"

echo ">>> Locking down SSH & enabling firewall"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/'   /etc/ssh/sshd_config
systemctl reload sshd
ufw allow OpenSSH && ufw --force enable

################################################################################
# 1.  ESSENTIAL BUILD TOOLCHAIN
################################################################################
echo ">>> Installing build-essentials & common libs"
apt install -y build-essential git curl wget tmux zsh htop jq \
               pkg-config libssl-dev unzip fd-find ripgrep bat exa fzf \
               python3 python3-pip python3-venv python3-dev pipx

pipx ensurepath

################################################################################
# 2.  NODE.JS 20 LTS (NodeSource) + PNPM/Yarn
################################################################################
echo ">>> Adding NodeSource repo"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -      # :contentReference[oaicite:0]{index=0}
apt install -y nodejs
npm install -g pnpm yarn

################################################################################
# 3.  RUST TOOLCHAIN
################################################################################
echo ">>> Installing Rust (rustup)"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y  # :contentReference[oaicite:1]{index=1}
echo 'source $HOME/.cargo/env' >> /etc/skel/.bashrc
echo 'source $HOME/.cargo/env' >> /home/$NEW_USER/.bashrc

################################################################################
# 4.  GO (latest stable binary from go.dev)
################################################################################
echo ">>> Installing Go"
GO_VERSION="$(curl -s https://go.dev/VERSION?m=text)"
wget -q "https://go.dev/dl/${GO_VERSION}.linux-${ARCH}.tar.gz" -O /tmp/go.tgz
rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> /etc/skel/.bashrc
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> /home/$NEW_USER/.bashrc

################################################################################
# 5.  JAVA (OpenJDK 21) & .NET 9 SDK
################################################################################
echo ">>> Installing OpenJDK & .NET"
apt install -y openjdk-21-jdk
apt install -y dotnet-sdk-9.0   # available natively on 24.10 repos  :contentReference[oaicite:2]{index=2}

################################################################################
# 6.  DOCKER ENGINE + COMPOSE PLUGIN
################################################################################
echo ">>> Installing Docker Engine"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $CODENAME stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update && apt install -y docker-ce docker-ce-cli containerd.io \
                             docker-buildx-plugin docker-compose-plugin  # :contentReference[oaicite:3]{index=3}
usermod -aG docker "$NEW_USER"
systemctl enable --now docker

################################################################################
# 7.  DATABASES (PostgreSQL, MariaDB, Redis, SQLite)
################################################################################
echo ">>> Installing common databases"
apt install -y postgresql postgresql-contrib mariadb-server redis-server sqlite3

################################################################################
# 8.  SHELL / EDITOR GOODIES
################################################################################
echo ">>> Setting Z-shell as default & installing oh-my-zsh"
chsh -s /usr/bin/zsh "$NEW_USER"
sudo -u "$NEW_USER" sh -c \
  'RUNZSH=no KEEP_ZSHRC=yes bash -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"'

apt install -y neovim
sudo -u "$NEW_USER" git clone https://github.com/nvim-lua/kickstart.nvim \
  "/home/$NEW_USER/.config/nvim"

################################################################################
# 9.  CLEAN-UP FOR IMAGE
################################################################################
echo ">>> Enabling unattended security upgrades"
dpkg-reconfigure --priority=low unattended-upgrades

echo ">>> Removing apt caches & logs"
apt autoremove -y && apt clean
rm -rf /var/lib/apt/lists/* /var/log/* ~/.bash_history

echo ">>> All done!"
echo "Snapshot hint: poweroff, take snapshot, then delete original droplet."
