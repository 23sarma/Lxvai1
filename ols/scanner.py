# Aegis Recon Scanner v1.0
import os

def initialize_recon():
    print("[+] Initializing Bug Bounty Recon Engine...")
    paths = ['logs', 'targets', 'results']
    for path in paths:
        if not os.path.exists(path):
            os.makedirs(path)
    print("[+] Directories created for Recon data.")

if __name__ == "__main__":
    initialize_recon()