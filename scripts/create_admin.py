import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.auth import MIN_PASSWORD_LENGTH, USERS_TABLE, hash_password
from database.supabase_client import get_client


def main():
    parser = argparse.ArgumentParser(
        description="Create an admin account, or make an existing account an admin with a new password"
    )
    parser.add_argument("email")
    parser.add_argument("--name", default="Administrator")
    args = parser.parse_args()

    email = args.email.strip().lower()
    # ADMIN_PASSWORD is for automated setups; otherwise type it, so it never lands in shell history.
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Password for the admin account: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"The password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if not os.getenv("ADMIN_PASSWORD") and getpass.getpass("Type it again: ") != password:
        sys.exit("The passwords did not match.")

    client = get_client()
    fields = {"name": args.name, "password_hash": hash_password(password), "role": "admin"}
    existing = client.table(USERS_TABLE).select("id").eq("email", email).limit(1).execute().data

    if existing:
        client.table(USERS_TABLE).update(fields).eq("id", existing[0]["id"]).execute()
        print(f"{email} is now an admin, with the new password.")
    else:
        client.table(USERS_TABLE).insert({"email": email, **fields}).execute()
        print(f"Created admin account {email}.")


if __name__ == "__main__":
    main()
