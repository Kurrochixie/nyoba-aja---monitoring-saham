"""Lapisan data: satu-satunya bagian aplikasi yang bicara langsung ke sumber data.

Tambah sumber baru = buat satu kelas turunan Provider lalu register() di registry.
UI/services tidak pernah meng-import sumber data langsung.
"""
