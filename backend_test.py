#!/usr/bin/env python3
"""
Backend API Test Suite for Birthday Globe
Tests the Next.js catch-all route at app/api/[[...path]]/route.js
"""

import requests
import json
import sys
from typing import Dict, Any

# Load environment variables
BASE_URL = "https://wish-circle-1.preview.emergentagent.com/api"
CRON_SECRET = "bday_cron_9f3a2c7e1b8d4f6a"

def print_test_header(test_name: str):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success: bool, message: str, details: Dict[str, Any] = None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {json.dumps(details, indent=2)}")

def test_health_endpoint():
    """Test GET /api/health endpoint"""
    print_test_header("GET /api/health")
    
    try:
        url = f"{BASE_URL}/health"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ['status', 'supabase', 'resend', 'from']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_result(False, f"Missing required fields: {missing_fields}", data)
            return False
        
        # Validate field values
        if data['status'] != 'ok':
            print_result(False, f"Expected status='ok', got '{data['status']}'", data)
            return False
        
        if data['supabase'] != True:
            print_result(False, f"Expected supabase=true, got {data['supabase']}", data)
            return False
        
        if data['resend'] != True:
            print_result(False, f"Expected resend=true, got {data['resend']}", data)
            return False
        
        if not data['from'] or 'notify@bdday.tech' not in data['from']:
            print_result(False, f"Expected 'from' to contain 'notify@bdday.tech', got '{data['from']}'", data)
            return False
        
        print_result(True, "Health endpoint returned correct response", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_email_endpoint_success():
    """Test POST /api/test-email with valid data"""
    print_test_header("POST /api/test-email (valid request)")
    
    try:
        url = f"{BASE_URL}/test-email"
        payload = {"to": "delivered@resend.dev"}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_result(False, "Expected 'ok' to be true", data)
            return False
        
        if 'id' not in data:
            print_result(False, "Expected 'id' field in response", data)
            return False
        
        print_result(True, "Test email sent successfully", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_email_endpoint_missing_to():
    """Test POST /api/test-email with missing 'to' field"""
    print_test_header("POST /api/test-email (missing 'to' field)")
    
    try:
        url = f"{BASE_URL}/test-email"
        payload = {}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            print_result(False, f"Expected status 400, got {response.status_code}")
            return False
        
        data = response.json()
        
        if 'error' not in data:
            print_result(False, "Expected 'error' field in response", data)
            return False
        
        if 'to' not in data['error'].lower() and 'required' not in data['error'].lower():
            print_result(False, f"Expected error message about 'to' being required, got: {data['error']}", data)
            return False
        
        print_result(True, "Correctly returned 400 error for missing 'to' field", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_reminders_no_auth():
    """Test POST /api/reminders/run without Authorization header"""
    print_test_header("POST /api/reminders/run (no Authorization)")
    
    try:
        url = f"{BASE_URL}/reminders/run"
        payload = {"dryRun": True}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        print("Headers: (no Authorization)")
        
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 401:
            print_result(False, f"Expected status 401, got {response.status_code}")
            return False
        
        data = response.json()
        
        if 'error' not in data:
            print_result(False, "Expected 'error' field in response", data)
            return False
        
        print_result(True, "Correctly returned 401 for missing Authorization", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_reminders_wrong_auth():
    """Test POST /api/reminders/run with wrong Authorization header"""
    print_test_header("POST /api/reminders/run (wrong Authorization)")
    
    try:
        url = f"{BASE_URL}/reminders/run"
        payload = {"dryRun": True}
        headers = {"Authorization": "Bearer wrong"}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        print(f"Headers: {headers}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 401:
            print_result(False, f"Expected status 401, got {response.status_code}")
            return False
        
        data = response.json()
        
        if 'error' not in data:
            print_result(False, "Expected 'error' field in response", data)
            return False
        
        print_result(True, "Correctly returned 401 for wrong Authorization", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_reminders_success_dry_run():
    """Test POST /api/reminders/run with correct Authorization and dryRun"""
    print_test_header("POST /api/reminders/run (correct auth, dryRun=true)")
    
    try:
        url = f"{BASE_URL}/reminders/run"
        payload = {"dryRun": True}
        headers = {"Authorization": f"Bearer {CRON_SECRET}"}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        print(f"Headers: Authorization: Bearer {CRON_SECRET}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected status 200, got {response.status_code}. Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ['ok', 'date', 'tasksFound', 'sent', 'skipped', 'failed', 'dryRun']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_result(False, f"Missing required fields: {missing_fields}", data)
            return False
        
        if data['ok'] != True:
            print_result(False, f"Expected ok=true, got {data['ok']}", data)
            return False
        
        if data['dryRun'] != True:
            print_result(False, f"Expected dryRun=true, got {data['dryRun']}", data)
            return False
        
        # Validate date format (YYYY-MM-DD)
        import re
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', data['date']):
            print_result(False, f"Expected date in YYYY-MM-DD format, got '{data['date']}'", data)
            return False
        
        # tasksFound can be 0 or more
        if not isinstance(data['tasksFound'], int) or data['tasksFound'] < 0:
            print_result(False, f"Expected tasksFound to be non-negative integer, got {data['tasksFound']}", data)
            return False
        
        print_result(True, f"Reminder engine working correctly. Found {data['tasksFound']} tasks for {data['date']}", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_reminders_with_days_ahead():
    """Test POST /api/reminders/run with daysAhead parameter"""
    print_test_header("POST /api/reminders/run (dryRun=true, daysAhead=0)")
    
    try:
        url = f"{BASE_URL}/reminders/run"
        payload = {"dryRun": True, "daysAhead": 0}
        headers = {"Authorization": f"Bearer {CRON_SECRET}"}
        print(f"Request: POST {url}")
        print(f"Body: {json.dumps(payload)}")
        print(f"Headers: Authorization: Bearer {CRON_SECRET}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('ok') != True:
            print_result(False, f"Expected ok=true, got {data.get('ok')}", data)
            return False
        
        print_result(True, f"Reminder engine accepts daysAhead parameter. Found {data.get('tasksFound', 0)} tasks", data)
        return True
        
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("BIRTHDAY GLOBE BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"CRON_SECRET: {CRON_SECRET}")
    
    results = []
    
    # Test 1: Health endpoint
    results.append(("GET /api/health", test_health_endpoint()))
    
    # Test 2: Email endpoint - success
    results.append(("POST /api/test-email (valid)", test_email_endpoint_success()))
    
    # Test 3: Email endpoint - missing 'to'
    results.append(("POST /api/test-email (missing 'to')", test_email_endpoint_missing_to()))
    
    # Test 4: Reminders - no auth
    results.append(("POST /api/reminders/run (no auth)", test_reminders_no_auth()))
    
    # Test 5: Reminders - wrong auth
    results.append(("POST /api/reminders/run (wrong auth)", test_reminders_wrong_auth()))
    
    # Test 6: Reminders - success with dryRun
    results.append(("POST /api/reminders/run (dryRun)", test_reminders_success_dry_run()))
    
    # Test 7: Reminders - with daysAhead parameter
    results.append(("POST /api/reminders/run (daysAhead)", test_reminders_with_days_ahead()))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
