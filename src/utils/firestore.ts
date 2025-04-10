import { getFirestore } from "firebase/firestore";
import firebaseApp from "./firebase";

const firestoreDb = getFirestore(firebaseApp);
export default firestoreDb;
