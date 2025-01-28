import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

import internal.GlobalVariable as GlobalVariable

def csv = findTestData('Dynamic_Data')
/*
CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()

CustomKeywords.'commonUtils.CommonKeywords.login'()

WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'), GlobalVariable.timeout)

CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerDetailspage'(1, 1)
*/

CustomKeywords.'customer.Common_CustomerKeywords.createCall'('Save')