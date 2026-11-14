import {jwtVerify} from 'jose';
export async function verifyAuthToken(token, key, issuer) {
 return jwtVerify(token,key,{issuer,algorithms:['EdDSA'],requiredClaims:['sub','exp','iat']});
}
