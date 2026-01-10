#!/usr/bin/env python3
"""Test Casper Wallet derivation - they use non-hardened last segments"""

import hashlib
import base64
import hmac
import struct
from mnemonic import Mnemonic
from nacl.signing import SigningKey
from nacl.encoding import RawEncoder

mnemonic = "assume unlock board ugly road miss seed seed right still trouble pulp shed auto earn token cause sentence tool blue enforce fever notice before"

mnemo = Mnemonic("english")
seed = mnemo.to_seed(mnemonic, passphrase="")

def derive_slip0010_hardened(seed, path):
    """SLIP-0010 with all hardened indices"""
    I = hmac.new(b"ed25519 seed", seed, hashlib.sha512).digest()
    key, chain = I[:32], I[32:]
    for idx in path:
        idx = idx + 0x80000000  # Hardened
        data = b'\x00' + key + struct.pack('>I', idx)
        I = hmac.new(chain, data, hashlib.sha512).digest()
        key, chain = I[:32], I[32:]
    return key

def get_account_info(private_key, method_name):
    """Get public key and account hash"""
    signing_key = SigningKey(private_key)
    public_key = signing_key.verify_key.encode(encoder=RawEncoder)
    account_hash = hashlib.blake2b(b"ed25519" + public_key, digest_size=32).hexdigest()
    print(f"\n{method_name}:")
    print(f"  Public key: 01{public_key.hex()}")
    print(f"  Account hash: {account_hash}")
    return private_key, public_key, account_hash

# Test various derivation paths used by different wallets
print("Testing Casper Wallet compatible derivation paths...")

# Standard Casper Wallet derivation: m/44'/506'/0'/0'/0'
pk1 = derive_slip0010_hardened(seed, [44, 506, 0, 0, 0])
get_account_info(pk1, "m/44'/506'/0'/0'/0' (5 levels, all hardened)")

# Shorter path: m/44'/506'/0'
pk2 = derive_slip0010_hardened(seed, [44, 506, 0])
get_account_info(pk2, "m/44'/506'/0' (3 levels)")

# Another common path: m/44'/506'/0'/0'
pk3 = derive_slip0010_hardened(seed, [44, 506, 0, 0])
get_account_info(pk3, "m/44'/506'/0'/0' (4 levels)")

# Direct seed usage (some simple wallets)
pk4 = seed[:32]
get_account_info(pk4, "Direct seed[:32]")

# SHA256 of seed (alternative method)
pk5 = hashlib.sha256(seed).digest()
get_account_info(pk5, "SHA256(seed)")

# Let's also try with the CSPR derivation path used by some browser extensions
# m/44'/506'/0'/0 with account index 0
pk6 = derive_slip0010_hardened(seed, [44, 506])
get_account_info(pk6, "m/44'/506' (2 levels)")

print("\n" + "="*70)
print("The user confirmed account hash: 0a3ecf18fc2001e44a0eba79be324698599a8f74b34a8122f50b979cc40d8315")
print("="*70)
