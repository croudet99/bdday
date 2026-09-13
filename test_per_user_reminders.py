#!/usr/bin/env python3
"""
Backend test for Birthday Globe - Per-user reminder timing feature
Tests the new reminder_offsets functionality
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('/app/.env')

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
CRON_SECRET = os.getenv('CRON_SECRET')

API_BASE = f"{BASE_URL}/api"

print(f"🧪 Testing Birthday Globe Backend - Per-user Reminder Timing")
print(f"📍 Base URL: {BASE_URL}")
print(f"📍 API Base: {API_BASE}")
print(f"📍 Supabase URL: {SUPABASE_URL}")
print("=" * 80)

# Track created resources for cleanup
created_users = []
created_follows = []

def cleanup():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    
    # Delete follows
    for follow in created_follows:
        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/follows",
                headers={
                    "apikey": SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                },
                params={
                    "follower_id": f"eq.{follow['follower_id']}",
                    "followed_id": f"eq.{follow['followed_id']}"
                }
            )
            if resp.status_code in [200, 204]:
                print(f"  ✓ Deleted follow {follow['follower_id'][:8]}... -> {follow['followed_id'][:8]}...")
        except Exception as e:
            print(f"  ⚠ Failed to delete follow: {e}")
    
    # Delete notifications and email_log for test users
    for user_id in created_users:
        try:
            # Delete notifications
            requests.delete(
                f"{SUPABASE_URL}/rest/v1/notifications",
                headers={
                    "apikey": SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
                },
                params={"recipient_id": f"eq.{user_id}"}
            )
            # Delete email_log entries
            requests.delete(
                f"{SUPABASE_URL}/rest/v1/email_log",
                headers={
                    "apikey": SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
                },
                params={"key": f"like.*{user_id}*"}
            )
        except Exception as e:
            print(f"  ⚠ Failed to delete notifications/email_log: {e}")
    
    # Delete auth users (cascades to profiles)
    for user_id in created_users:
        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
                }
            )
            if resp.status_code in [200, 204]:
                print(f"  ✓ Deleted user {user_id[:8]}...")
        except Exception as e:
            print(f"  ⚠ Failed to delete user {user_id}: {e}")
    
    print("✅ Cleanup complete")

def create_auth_user(email, password, display_name):
    """Create a Supabase auth user"""
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"display_name": display_name}
        }
    )
    if resp.status_code not in [200, 201]:
        raise Exception(f"Failed to create user: {resp.status_code} {resp.text}")
    user = resp.json()
    user_id = user['id']
    created_users.append(user_id)
    print(f"  ✓ Created auth user {email} (id: {user_id[:8]}...)")
    return user_id

def update_profile(user_id, updates):
    """Update a user's profile"""
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        params={"id": f"eq.{user_id}"},
        json=updates
    )
    if resp.status_code not in [200, 204]:
        raise Exception(f"Failed to update profile: {resp.status_code} {resp.text}")
    print(f"  ✓ Updated profile for {user_id[:8]}... with {updates}")
    return resp.json()

def create_follow(follower_id, followed_id):
    """Create a follow relationship"""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/follows",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        json={
            "follower_id": follower_id,
            "followed_id": followed_id
        }
    )
    if resp.status_code not in [200, 201]:
        raise Exception(f"Failed to create follow: {resp.status_code} {resp.text}")
    created_follows.append({"follower_id": follower_id, "followed_id": followed_id})
    print(f"  ✓ Created follow {follower_id[:8]}... -> {followed_id[:8]}...")
    return resp.json()

def get_user_token(email, password):
    """Get access token for a user"""
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        json={
            "email": email,
            "password": password
        }
    )
    if resp.status_code != 200:
        raise Exception(f"Failed to get token: {resp.status_code} {resp.text}")
    return resp.json()['access_token']

def check_email_details(details, expected_to, expected_subject_contains):
    """Check if email was sent with expected details"""
    for detail in details:
        if detail.get('to') == expected_to and expected_subject_contains in detail.get('subject', ''):
            return True
    return False

# ============================================================================
# TEST A: GET /api/reminders/run works + auth
# ============================================================================
print("\n" + "=" * 80)
print("TEST A: GET /api/reminders/run with auth")
print("=" * 80)

try:
    # A1: No auth header -> 401
    print("\n[A1] Testing GET /api/reminders/run without auth header...")
    resp = requests.get(f"{API_BASE}/reminders/run")
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text}")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    assert 'Unauthorized' in resp.text, "Expected 'Unauthorized' in response"
    print("  ✅ PASS: Returns 401 without auth")
    
    # A2: Correct auth -> 200 with expected fields
    print("\n[A2] Testing GET /api/reminders/run with correct CRON_SECRET...")
    resp = requests.get(
        f"{API_BASE}/reminders/run",
        headers={"Authorization": f"Bearer {CRON_SECRET}"}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    # Retry once on 502
    if resp.status_code == 502:
        print("  ⚠ Got 502, retrying once (dev server may restart)...")
        import time
        time.sleep(2)
        resp = requests.get(
            f"{API_BASE}/reminders/run",
            headers={"Authorization": f"Bearer {CRON_SECRET}"}
        )
        print(f"  Retry Status: {resp.status_code}")
        data = resp.json()
        print(f"  Retry Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    assert 'offsets' in data, "Expected 'offsets' field"
    assert isinstance(data['offsets'], list), "Expected 'offsets' to be array"
    assert 'tasksFound' in data, "Expected 'tasksFound' field"
    assert 'sent' in data, "Expected 'sent' field"
    assert 'skipped' in data, "Expected 'skipped' field"
    assert 'failed' in data, "Expected 'failed' field"
    print("  ✅ PASS: Returns 200 with ok:true and all required fields")
    print(f"  ✅ PASS: offsets={data['offsets']}, tasksFound={data['tasksFound']}, sent={data['sent']}, skipped={data['skipped']}, failed={data['failed']}")
    
except AssertionError as e:
    print(f"  ❌ FAIL: {e}")
    sys.exit(1)
except Exception as e:
    print(f"  ❌ ERROR: {e}")
    sys.exit(1)

# ============================================================================
# TEST B: Per-user timing is respected
# ============================================================================
print("\n" + "=" * 80)
print("TEST B: Per-user reminder timing (core new feature)")
print("=" * 80)

try:
    # Calculate date 3 days from now (UTC)
    today = datetime.utcnow()
    three_days_ahead = today + timedelta(days=3)
    birth_month = three_days_ahead.month
    birth_day = three_days_ahead.day
    
    print(f"\n📅 Today (UTC): {today.strftime('%Y-%m-%d')}")
    print(f"📅 3 days ahead: {three_days_ahead.strftime('%Y-%m-%d')} (month={birth_month}, day={birth_day})")
    
    # B1: Create users
    print("\n[B1] Creating test users...")
    user_a_email = "delivered@resend.dev"
    user_a_password = "TestPass123!@#"
    
    # First, try to delete any existing user with this email
    print(f"  Checking for existing user with email {user_a_email}...")
    try:
        # Get user by email
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
            }
        )
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            for user in users:
                if user.get('email') == user_a_email:
                    print(f"  Found existing user {user['id'][:8]}..., deleting...")
                    requests.delete(
                        f"{SUPABASE_URL}/auth/v1/admin/users/{user['id']}",
                        headers={
                            "apikey": SERVICE_ROLE_KEY,
                            "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
                        }
                    )
                    print(f"  ✓ Deleted existing user")
                    import time
                    time.sleep(1)  # Wait for deletion to complete
    except Exception as e:
        print(f"  ⚠ Error checking/deleting existing user: {e}")
    
    user_a_id = create_auth_user(user_a_email, user_a_password, "Test Follower A")
    
    user_b_email = f"birthday_person_{datetime.utcnow().timestamp()}@example.com"
    user_b_password = "TestPass456!@#"
    user_b_id = create_auth_user(user_b_email, user_b_password, "Test Birthday Person B")
    
    # B2: Create follow A->B
    print("\n[B2] Creating follow relationship A->B...")
    create_follow(user_a_id, user_b_id)
    
    # B3: Set B's birthday to 3 days from now
    print("\n[B3] Setting B's birthday to 3 days from now...")
    update_profile(user_b_id, {
        "birth_month": birth_month,
        "birth_day": birth_day,
        "is_public": True,
        "reminders_enabled": True,
        "onboarded": True
    })
    
    # B4: Set A's reminder_offsets to {1} (only 1-day reminders)
    print("\n[B4] Setting A's reminder_offsets to {1} (only 1-day reminders)...")
    update_profile(user_a_id, {
        "reminder_offsets": [1],
        "reminders_enabled": True,
        "onboarded": True
    })
    
    # B5: Call POST /api/reminders/run (default offsets 0,1,3)
    print("\n[B5] Calling POST /api/reminders/run with default offsets [0,1,3]...")
    print("  Expected: A should NOT be emailed (B is 3 days away, A only wants 1-day)")
    resp = requests.post(
        f"{API_BASE}/reminders/run",
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json"
        },
        json={}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    # Retry once on 502
    if resp.status_code == 502:
        print("  ⚠ Got 502, retrying once (dev server may restart)...")
        import time
        time.sleep(2)
        resp = requests.post(
            f"{API_BASE}/reminders/run",
            headers={
                "Authorization": f"Bearer {CRON_SECRET}",
                "Content-Type": "application/json"
            },
            json={}
        )
        print(f"  Retry Status: {resp.status_code}")
        data = resp.json()
        print(f"  Retry Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    
    # Check that A was NOT emailed for B
    details = data.get('details', [])
    was_emailed = check_email_details(details, user_a_email, "Test Birthday Person B")
    assert not was_emailed, f"Expected A NOT to be emailed (timing filter should exclude), but found email in details"
    print("  ✅ PASS: A was NOT emailed (timing filter correctly excluded 3-day reminder)")
    
    # B6: Set A's reminder_offsets to {3} (only 3-day reminders)
    print("\n[B6] Setting A's reminder_offsets to {3} (only 3-day reminders)...")
    update_profile(user_a_id, {
        "reminder_offsets": [3]
    })
    
    # B7: Call POST /api/reminders/run again
    print("\n[B7] Calling POST /api/reminders/run again...")
    print("  Expected: A SHOULD be emailed now (B is 3 days away, A wants 3-day)")
    resp = requests.post(
        f"{API_BASE}/reminders/run",
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json"
        },
        json={}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    # Retry once on 502
    if resp.status_code == 502:
        print("  ⚠ Got 502, retrying once (dev server may restart)...")
        import time
        time.sleep(2)
        resp = requests.post(
            f"{API_BASE}/reminders/run",
            headers={
                "Authorization": f"Bearer {CRON_SECRET}",
                "Content-Type": "application/json"
            },
            json={}
        )
        print(f"  Retry Status: {resp.status_code}")
        data = resp.json()
        print(f"  Retry Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    assert data.get('sent', 0) >= 1, f"Expected sent>=1, got {data.get('sent', 0)}"
    
    # Check that A WAS emailed for B with "is in 3 days"
    details = data.get('details', [])
    was_emailed = check_email_details(details, user_a_email, "is in 3 days")
    assert was_emailed, f"Expected A to be emailed with 'is in 3 days' in subject, but not found in details: {details}"
    
    # Also check B's name is in the subject
    was_emailed_with_name = check_email_details(details, user_a_email, "Test Birthday Person B")
    assert was_emailed_with_name, f"Expected B's name in subject, but not found in details: {details}"
    
    print("  ✅ PASS: A WAS emailed with 'is in 3 days' and B's name in subject")
    print(f"  ✅ PASS: sent={data.get('sent')}, tasksFound={data.get('tasksFound')}")
    
    # B8: Dedupe test - call again immediately
    print("\n[B8] Testing deduplication - calling again immediately...")
    resp = requests.post(
        f"{API_BASE}/reminders/run",
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json"
        },
        json={}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    assert data.get('skipped', 0) >= 1, f"Expected skipped>=1 (deduplication), got {data.get('skipped', 0)}"
    print("  ✅ PASS: Deduplication working (skipped>=1)")
    
except AssertionError as e:
    print(f"  ❌ FAIL: {e}")
    cleanup()
    sys.exit(1)
except Exception as e:
    print(f"  ❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    cleanup()
    sys.exit(1)

# ============================================================================
# TEST C: Force override still works
# ============================================================================
print("\n" + "=" * 80)
print("TEST C: Force override for manual runs")
print("=" * 80)

try:
    print("\n[C1] Calling POST /api/reminders/run with {daysAhead:3}...")
    print("  This sets force=true and offsets=[3]")
    print("  Even users with reminder_offsets={1} would be emailed (if not deduped)")
    
    resp = requests.post(
        f"{API_BASE}/reminders/run",
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json"
        },
        json={"daysAhead": 3}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    # Retry once on 502
    if resp.status_code == 502:
        print("  ⚠ Got 502, retrying once (dev server may restart)...")
        import time
        time.sleep(2)
        resp = requests.post(
            f"{API_BASE}/reminders/run",
            headers={
                "Authorization": f"Bearer {CRON_SECRET}",
                "Content-Type": "application/json"
            },
            json={"daysAhead": 3}
        )
        print(f"  Retry Status: {resp.status_code}")
        data = resp.json()
        print(f"  Retry Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    assert data.get('force') == True, "Expected force:true when daysAhead is specified"
    assert data.get('offsets') == [3], f"Expected offsets:[3], got {data.get('offsets')}"
    print("  ✅ PASS: Force override works (force:true, offsets:[3])")
    print("  Note: Email may be skipped due to deduplication from previous test (expected)")
    
except AssertionError as e:
    print(f"  ❌ FAIL: {e}")
    cleanup()
    sys.exit(1)
except Exception as e:
    print(f"  ❌ ERROR: {e}")
    cleanup()
    sys.exit(1)

# ============================================================================
# TEST D: Self-test endpoint still works
# ============================================================================
print("\n" + "=" * 80)
print("TEST D: Self-test endpoint")
print("=" * 80)

try:
    print("\n[D1] Getting access token for user A...")
    token = get_user_token(user_a_email, user_a_password)
    print(f"  ✓ Got token: {token[:20]}...")
    
    print("\n[D2] Calling POST /api/reminders/self-test with user token...")
    resp = requests.post(
        f"{API_BASE}/reminders/self-test",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={}
    )
    print(f"  Status: {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2)}")
    
    # Retry once on 502
    if resp.status_code == 502:
        print("  ⚠ Got 502, retrying once (dev server may restart)...")
        import time
        time.sleep(2)
        resp = requests.post(
            f"{API_BASE}/reminders/self-test",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={}
        )
        print(f"  Retry Status: {resp.status_code}")
        data = resp.json()
        print(f"  Retry Response: {json.dumps(data, indent=2)}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data.get('ok') == True, "Expected ok:true"
    assert data.get('to') == user_a_email, f"Expected to:{user_a_email}, got {data.get('to')}"
    assert 'id' in data, "Expected 'id' field (Resend email id)"
    print("  ✅ PASS: Self-test endpoint works")
    print(f"  ✅ PASS: Email sent to {data.get('to')}, id={data.get('id')}")
    
except AssertionError as e:
    print(f"  ❌ FAIL: {e}")
    cleanup()
    sys.exit(1)
except Exception as e:
    print(f"  ❌ ERROR: {e}")
    cleanup()
    sys.exit(1)

# ============================================================================
# Cleanup
# ============================================================================
cleanup()

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("🎉 ALL TESTS PASSED!")
print("=" * 80)
print("\n✅ TEST A: GET /api/reminders/run with auth - PASS")
print("  - Returns 401 without auth")
print("  - Returns 200 with correct CRON_SECRET and all required fields")
print("\n✅ TEST B: Per-user reminder timing - PASS")
print("  - User with reminder_offsets={1} NOT emailed for 3-day birthday")
print("  - User with reminder_offsets={3} IS emailed for 3-day birthday")
print("  - Email contains 'is in 3 days' and birthday person's name")
print("  - Deduplication working (skipped>=1 on second call)")
print("\n✅ TEST C: Force override - PASS")
print("  - daysAhead parameter sets force=true and offsets=[3]")
print("\n✅ TEST D: Self-test endpoint - PASS")
print("  - Works with valid user access token")
print("  - Email sent to user's email address")
print("=" * 80)
