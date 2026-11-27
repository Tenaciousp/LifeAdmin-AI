"""Synthetic only: all transport is mocked; no credential or provider access."""
import os
import unittest
from unittest.mock import patch
import app
import customer_ai
from test_gemini_draft import RouteHandler

class CustomerAiTests(unittest.TestCase):
    def route(self, body, enabled=False):
        handler=RouteHandler(body)
        handler.path='/api/ai/customer'
        handler.headers['X-Customer-Provider-Key']='synthetic-not-a-real-key'
        with patch.dict(os.environ,{'CUSTOMER_KEY_AI_ENABLED':str(enabled).lower()}), patch.object(app,'customer_ai_rate_limited',return_value=False):
            app.AdminPilotHandler._do_POST(handler)
        return handler.status,handler.payload()

    def test_disabled_and_missing_consent_never_forward(self):
        with patch.object(customer_ai,'generate') as generate:
            self.assertEqual(self.route({'consent':True})[0],503)
            self.assertEqual(self.route({'consent':False},True)[0],400)
            generate.assert_not_called()

    def test_malformed_output_is_rejected_before_transport(self):
        for output in ({'bad':True},None,[],3):
            with patch.object(customer_ai,'_post') as transport:
                status,_=self.route({'provider':'gemini','prompt':'Synthetic fixture','output':output,'consent':True},True)
                self.assertEqual(status,400)
                transport.assert_not_called()

    def test_synthetic_provider_paths_require_research_evidence(self):
        cases=[('openai','_openai'),('anthropic','_anthropic'),('gemini','_gemini')]
        for provider,method in cases:
            value=('Synthetic comparison',[{'title':'Fictional source','url':'https://offers.provider.example/offer'}],[],'synthetic-model',True)
            if provider=='gemini': value+=('<p>Search</p>',)
            with patch.object(customer_ai,method,return_value=value):
                result=customer_ai.generate(provider,'synthetic-not-a-real-key','Synthetic fixture','plan',True)
                self.assertEqual(result['provider'],provider)
                self.assertTrue(result['checked_at'])
                self.assertNotIn('synthetic-not-a-real-key',str(result))
            bad=('Synthetic answer',[],[],'synthetic-model',False)+ (('',) if provider=='gemini' else ())
            with patch.object(customer_ai,method,return_value=bad):
                with self.assertRaisesRegex(RuntimeError,'research_evidence'):
                    customer_ai.generate(provider,'synthetic-not-a-real-key','Synthetic fixture','plan',True)

    def test_provider_errors_are_generic(self):
        with patch.object(customer_ai,'generate',side_effect=RuntimeError('provider_key')):
            status,result=self.route({'provider':'openai','prompt':'Synthetic fixture','output':'letter','consent':True},True)
            self.assertEqual(status,401)
            self.assertNotIn('synthetic-not-a-real-key',str(result))
