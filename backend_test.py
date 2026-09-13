#!/usr/bin/env python3
"""
Birthday Globe Backend E2E Test Suite
Tests the email reminder pipeline end-to-end
"""

import requests
import json
import os
import time
from datetime import datetime, timedelta
import random
import string

# Load environment variables from .env file
from pathlib import Path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://wish-circle-1.preview.emergentagent.com')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://ywbltvxhgufxzxfwuiyy.supabase.co')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
CRON_SECRET = os.getenv('CRON_SECRET', 'bday_cron_9f3a2c7e1b8d4f6a')

API_BASE = f"{BASE_URL}/api"

# Debug: Print loaded environment variables
print(f"DEBUG: SERVICE_ROLE_KEY loaded: {SERVICE_ROLE_KEY is not None}")
print(f"DEBUG: ANON_KEY loaded: {ANON_KEY is not None}")

# Supabase admin headers
SUPABASE_HEADERS = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json'
}

def random_string(length=8):
    """Generate random string for unique emails"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def wait_for_server(max_retries=3, delay=10):
    """Wait for server to be ready, retry on 502"""
    for i in range(max_retries):
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                print(f"✅ Server is ready: {response.json()}")
                return True
            elif response.status_code == 502:
                print(f"⚠️  Got 502, waiting {delay}s before retry {i+1}/{max_retries}...")
                time.sleep(delay)
            else:
                print(f"⚠️  Unexpected status {response.status_code}, retrying...")
                time.sleep(delay)
        except Exception as e:
            print(f"⚠️  Connection error: {e}, retrying...")
            time.sleep(delay)
    return False

def create_auth_user(email, password="Passw0rd!123"):
    """Create a Supabase auth user"""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True
    }
    response = requests.post(url, headers=SUPABASE_HEADERS, json=payload)
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"✅ Created auth user: {email} (id: {data['id']})")
        return data
    else:
        print(f"❌ Failed to create auth user {email}: {response.status_code} {response.text}")
        return None

def delete_auth_user(user_id):
    """Delete a Supabase auth user (cascades to profiles)"""
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    response = requests.delete(url, headers=SUPABASE_HEADERS)
    if response.status_code in [200, 204]:
        print(f"✅ Deleted auth user: {user_id}")
        return True
    else:
        print(f"⚠️  Failed to delete auth user {user_id}: {response.status_code}")
        return False

def update_profile(user_id, data):
    """Update a profile via Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}"
    headers = {**SUPABASE_HEADERS, 'Prefer': 'return=representation'}
    response = requests.patch(url, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Updated profile {user_id}: {data}")
        return result
    else:
        print(f"❌ Failed to update profile {user_id}: {response.status_code} {response.text}")
        return None

def create_follow(follower_id, followed_id):
    """Create a follow relationship"""
    url = f"{SUPABASE_URL}/rest/v1/follows"
    payload = {
        "follower_id": follower_id,
        "followed_id": followed_id
    }
    response = requests.post(url, headers=SUPABASE_HEADERS, json=payload)
    if response.status_code in [200, 201]:
        print(f"✅ Created follow: {follower_id} -> {followed_id}")
        return True
    else:
        print(f"❌ Failed to create follow: {response.status_code} {response.text}")
        return False

def delete_follow(follower_id, followed_id):
    """Delete a follow relationship"""
    url = f"{SUPABASE_URL}/rest/v1/follows?follower_id=eq.{follower_id}&followed_id=eq.{followed_id}"
    response = requests.delete(url, headers=SUPABASE_HEADERS)
    if response.status_code in [200, 204]:
        print(f"✅ Deleted follow: {follower_id} -> {followed_id}")
        return True
    else:
        print(f"⚠️  Failed to delete follow: {response.status_code}")
        return False

def get_notifications(recipient_id):
    """Get notifications for a user"""
    url = f"{SUPABASE_URL}/rest/v1/notifications?recipient_id=eq.{recipient_id}"
    response = requests.get(url, headers=SUPABASE_HEADERS)
    if response.status_code == 200:
        return response.json()
    return []

def delete_notifications(recipient_id):
    """Delete notifications for a user"""
    url = f"{SUPABASE_URL}/rest/v1/notifications?recipient_id=eq.{recipient_id}"
    response = requests.delete(url, headers=SUPABASE_HEADERS)
    return response.status_code in [200, 204]

def delete_email_logs_for_user(user_id):
    """Delete email logs containing user_id"""
    url = f"{SUPABASE_URL}/rest/v1/email_log?key=like.*{user_id}*"
    response = requests.delete(url, headers=SUPABASE_HEADERS)
    return response.status_code in [200, 204]

def get_user_access_token(email, password="Passw0rd!123"):
    """Get user access token via password grant"""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        "email": email,
        "password": password
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Got access token for {email}")
        return data.get('access_token')
    else:
        print(f"❌ Failed to get access token for {email}: {response.status_code} {response.text}")
        return None

def test_1_end_to_end_24h_reminder():
    """
    TEST 1: End-to-end 24h reminder via POST /api/reminders/run
    Creates a follower and a followed user with tomorrow's birthday,
    then verifies the reminder email is sent.
    """
    print("\n" + "="*80)
    print("TEST 1: End-to-end 24h reminder via POST /api/reminders/run")
    print("="*80)
    
    user_a_id = None
    user_b_id = None
    
    try:
        # Step 1: Create auth user A (follower/subscriber)
        # Use delivered@resend.dev for successful email delivery simulation
        print("\n[Step 1] Creating auth user A (follower)...")
        rand_a = random_string()
        # We'll use a unique email but update the profile to use delivered@resend.dev
        user_a_email = f"test-a-{rand_a}@example.com"
        user_a = create_auth_user(user_a_email, "Passw0rd!123")
        if not user_a:
            print("❌ TEST 1 FAILED: Could not create user A")
            return False
        user_a_id = user_a['id']
        
        # Step 2: Create auth user B (birthday person)
        print("\n[Step 2] Creating auth user B (birthday person)...")
        rand = random_string()
        user_b_email = f"bday-b-{rand}@example.com"
        user_b = create_auth_user(user_b_email, "Passw0rd!123")
        if not user_b:
            print("❌ TEST 1 FAILED: Could not create user B")
            return False
        user_b_id = user_b['id']
        
        # Step 3: Compute TOMORROW in UTC
        print("\n[Step 3] Computing tomorrow's date in UTC...")
        tomorrow = datetime.utcnow() + timedelta(days=1)
        tomorrow_month = tomorrow.month
        tomorrow_day = tomorrow.day
        print(f"✅ Tomorrow is: {tomorrow_month}/{tomorrow_day}")
        
        # Step 4: Update profile B with tomorrow's birthday
        print("\n[Step 4] Updating profile B with tomorrow's birthday...")
        profile_b_data = {
            "display_name": "Test Person B",
            "birth_month": tomorrow_month,
            "birth_day": tomorrow_day,
            "is_public": True,
            "reminders_enabled": True,
            "country_code": "US",
            "onboarded": True
        }
        if not update_profile(user_b_id, profile_b_data):
            print("❌ TEST 1 FAILED: Could not update profile B")
            return False
        
        # Step 5: Update profile A
        print("\n[Step 5] Updating profile A...")
        profile_a_data = {
            "display_name": "Test A",
            "email": "delivered@resend.dev",
            "reminders_enabled": True,
            "onboarded": True
        }
        if not update_profile(user_a_id, profile_a_data):
            print("❌ TEST 1 FAILED: Could not update profile A")
            return False
        
        # Step 6: Create follow relationship
        print("\n[Step 6] Creating follow relationship A -> B...")
        if not create_follow(user_a_id, user_b_id):
            print("❌ TEST 1 FAILED: Could not create follow")
            return False
        
        # Step 7: Call POST /api/reminders/run
        print("\n[Step 7] Calling POST /api/reminders/run...")
        url = f"{API_BASE}/reminders/run"
        headers = {
            'Authorization': f'Bearer {CRON_SECRET}',
            'Content-Type': 'application/json'
        }
        payload = {}  # daysAhead defaults to 1
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"✅ Response JSON: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        if not data.get('ok'):
            print("❌ TEST 1 FAILED: Response ok is not true")
            return False
        
        if data.get('tasksFound', 0) < 1:
            print(f"❌ TEST 1 FAILED: Expected tasksFound >= 1, got {data.get('tasksFound')}")
            return False
        
        if data.get('sent', 0) < 1:
            print(f"❌ TEST 1 FAILED: Expected sent >= 1, got {data.get('sent')}")
            return False
        
        # Verify details contains email to delivered@resend.dev
        details = data.get('details', [])
        found_email = False
        for detail in details:
            if detail.get('to') == 'delivered@resend.dev':
                found_email = True
                subject = detail.get('subject', '')
                print(f"✅ Found email to delivered@resend.dev with subject: {subject}")
                if 'Test Person B' not in subject:
                    print(f"⚠️  Warning: Subject doesn't mention 'Test Person B': {subject}")
                if 'tomorrow' not in subject.lower():
                    print(f"⚠️  Warning: Subject doesn't mention 'tomorrow': {subject}")
                break
        
        if not found_email:
            print(f"❌ TEST 1 FAILED: No email found to delivered@resend.dev in details: {details}")
            return False
        
        print("✅ TEST 1 STEP 7 PASSED: Email sent successfully")
        
        # Step 8: Verify dedupe - call again
        print("\n[Step 8] Verifying deduplication - calling endpoint again...")
        response2 = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"Response status: {response2.status_code}")
        print(f"Response body: {response2.text}")
        
        if response2.status_code != 200:
            print(f"⚠️  Warning: Second call returned {response2.status_code}")
        else:
            data2 = response2.json()
            print(f"✅ Second call response: {json.dumps(data2, indent=2)}")
            if data2.get('skipped', 0) >= 1:
                print("✅ Deduplication working: skipped >= 1")
            else:
                print(f"⚠️  Warning: Expected skipped >= 1, got {data2.get('skipped')}")
        
        # Step 9: Verify notification was created
        print("\n[Step 9] Verifying notification was created for user A...")
        notifications = get_notifications(user_a_id)
        print(f"Found {len(notifications)} notifications for user A")
        
        followed_birthday_notif = [n for n in notifications if n.get('type') == 'followed_birthday']
        if followed_birthday_notif:
            print(f"✅ Found followed_birthday notification: {followed_birthday_notif[0]}")
        else:
            print(f"⚠️  Warning: No followed_birthday notification found. All notifications: {notifications}")
        
        print("\n✅ TEST 1 PASSED: End-to-end 24h reminder working!")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup
        print("\n[Cleanup] Deleting test data...")
        if user_a_id and user_b_id:
            delete_follow(user_a_id, user_b_id)
        if user_a_id:
            delete_notifications(user_a_id)
            delete_email_logs_for_user(user_a_id)
            delete_auth_user(user_a_id)
        if user_b_id:
            delete_email_logs_for_user(user_b_id)
            delete_auth_user(user_b_id)
        print("✅ Cleanup complete")

def test_2_self_test_endpoint():
    """
    TEST 2: POST /api/reminders/self-test (user preview button)
    Tests authentication and self-test email functionality
    """
    print("\n" + "="*80)
    print("TEST 2: POST /api/reminders/self-test (user preview button)")
    print("="*80)
    
    user_id = None
    
    try:
        # Test 2.1: No Authorization header
        print("\n[Test 2.1] Testing without Authorization header...")
        url = f"{API_BASE}/reminders/self-test"
        response = requests.post(url, json={}, timeout=10)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code != 401:
            print(f"❌ TEST 2.1 FAILED: Expected 401, got {response.status_code}")
            return False
        
        data = response.json()
        if 'error' not in data or 'Unauthorized' not in data['error']:
            print(f"❌ TEST 2.1 FAILED: Expected Unauthorized error, got {data}")
            return False
        
        print("✅ TEST 2.1 PASSED: Returns 401 without Authorization header")
        
        # Test 2.2: Invalid token
        print("\n[Test 2.2] Testing with invalid token...")
        headers = {'Authorization': 'Bearer not-a-real-token'}
        response = requests.post(url, headers=headers, json={}, timeout=10)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code != 401:
            print(f"❌ TEST 2.2 FAILED: Expected 401, got {response.status_code}")
            return False
        
        print("✅ TEST 2.2 PASSED: Returns 401 with invalid token")
        
        # Test 2.3: Valid token
        print("\n[Test 2.3] Testing with valid user token...")
        
        # Create a test user with unique email
        print("Creating test user for self-test...")
        rand = random_string()
        # Use unique email for auth, but set profile email to delivered@resend.dev
        test_auth_email = f"test-self-{rand}@example.com"
        test_email = "delivered@resend.dev"  # Use Resend success simulator
        user = create_auth_user(test_auth_email, "Passw0rd!123")
        if not user:
            print("❌ TEST 2.3 FAILED: Could not create test user")
            return False
        user_id = user['id']
        
        # Update profile with delivered@resend.dev
        profile_data = {
            "display_name": "Test Self User",
            "email": test_email,
            "reminders_enabled": True,
            "onboarded": True
        }
        update_profile(user_id, profile_data)
        
        # Get access token using the auth email
        access_token = get_user_access_token(test_auth_email, "Passw0rd!123")
        if not access_token:
            print("❌ TEST 2.3 FAILED: Could not get access token")
            return False
        
        # Call self-test endpoint
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.post(url, headers=headers, json={}, timeout=30)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2.3 FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"✅ Response JSON: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        if not data.get('ok'):
            print(f"❌ TEST 2.3 FAILED: Expected ok:true, got {data}")
            return False
        
        if data.get('to') != test_email:
            print(f"❌ TEST 2.3 FAILED: Expected to:{test_email}, got {data.get('to')}")
            return False
        
        if 'id' not in data:
            print(f"❌ TEST 2.3 FAILED: Expected 'id' field (Resend email id), got {data}")
            return False
        
        print(f"✅ Email sent to: {data.get('to')}")
        print(f"✅ Subject name: {data.get('subjectName')}")
        print(f"✅ Days until: {data.get('daysUntil')}")
        print(f"✅ Had upcoming: {data.get('hadUpcoming')}")
        print(f"✅ Resend ID: {data.get('id')}")
        
        print("✅ TEST 2.3 PASSED: Self-test endpoint working with valid token")
        
        # Verify notification was created
        print("\n[Verification] Checking if test notification was created...")
        notifications = get_notifications(user_id)
        test_notif = [n for n in notifications if n.get('type') == 'test_reminder']
        if test_notif:
            print(f"✅ Found test_reminder notification: {test_notif[0]}")
        else:
            print(f"⚠️  Warning: No test_reminder notification found")
        
        print("\n✅ TEST 2 PASSED: Self-test endpoint working!")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup
        print("\n[Cleanup] Deleting test data...")
        if user_id:
            delete_notifications(user_id)
            delete_email_logs_for_user(user_id)
            delete_auth_user(user_id)
        print("✅ Cleanup complete")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BIRTHDAY GLOBE BACKEND E2E TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"CRON Secret: {CRON_SECRET}")
    
    # Wait for server to be ready
    print("\n[Pre-check] Waiting for server to be ready...")
    if not wait_for_server():
        print("❌ Server not ready, aborting tests")
        return
    
    results = {}
    
    # Run tests
    results['test_1'] = test_1_end_to_end_24h_reminder()
    results['test_2'] = test_2_self_test_endpoint()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)
    
    return all_passed

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
