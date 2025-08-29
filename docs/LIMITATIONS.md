## MYSTO FF3 Library Limitations (Technical Details)

Based on comprehensive testing and official documentation, the MYSTO FF3 library has specific constraints:

### **Radix Support**
- **radix 10**: digits 0-9 only (what this implementation uses)
- **radix 36**: alphanumeric 0-9, a-z (possible extension)
- **No UTF-8 or special characters** supported
- **No mixed formats**: Cannot preserve patterns like "A123456" (letter + digits)

### **Length Limits**
- **Minimum**: 6 digits required (discovered through testing, not documented)
- **Maximum**: 56 digits for radix-10 (per official FF3 spec: 2 * floor(96/log2(radix)))
- **Formula**: radix 10 = 56 max, radix 36 = 36 max

### **Input Processing**
- All non-digits are **automatically stripped** during normalization
- Input "123-45-6789" becomes "123456789" before encryption
- Output is **pure digits only** with ENC_FPE: prefix
- **Format reconstruction is user/LLM responsibility**

### **Key Requirements**
- **Key length**: 128, 192, or 256 bits (we use 128-bit demo key)
- **Tweak**: 7 bytes (FF3-1) or 8 bytes (FF3) - we use 8 bytes

### **Common Use Cases That Work**
✅ SSNs: "123-45-6789" → normalize to "123456789" → encrypt  
✅ Phone: "(555) 123-4567" → normalize to "5551234567" → encrypt  
✅ Credit Cards: "4000 1234 5678 9999" → normalize to "4000123456789999" → encrypt  
✅ Account Numbers: Pure digits 6-56 characters long

### **What Won't Work**
❌ "A123456" (mixed letters + digits)  
❌ "12345" (less than 6 digits)  
❌ 57+ digit strings (exceeds FF3 radix-10 limit)  
❌ Unicode or special characters  
❌ True format preservation (output is always pure digits)

This implementation is honest about these limitations rather than trying to work around them with complex format reconstruction that could mislead users about FF3 FPE capabilities.

## Demo Scope

FPE Demo MCP is a **demo implementation** showing:
- How FF3 FPE works with real constraints
- MCP server patterns for LLM integration  
- Authentication approaches (authless/debug/test modes, plus production mode for stricter testing)
- Dual transport support (stdio + HTTP MCP Streamable)

This is a demo for learning and testing - not intended for real-world deployment.