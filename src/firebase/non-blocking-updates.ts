
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestoreContextualError } from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  setDoc(docRef, data, options).catch((error: FirestoreError) => {
    errorEmitter.emit(
      'permission-error',
      new FirestoreContextualError({
        path: docRef.path,
        operation: options.merge ? 'update' : 'create',
        requestResourceData: data,
      }, error)
    )
  })
  // Execution continues immediately
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data)
    .catch((error: FirestoreError) => {
      errorEmitter.emit(
        'permission-error',
        new FirestoreContextualError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        }, error)
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data)
    .catch((error: FirestoreError) => {
      errorEmitter.emit(
        'permission-error',
        new FirestoreContextualError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        }, error)
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch((error: FirestoreError) => {
      errorEmitter.emit(
        'permission-error',
        new FirestoreContextualError({
          path: docRef.path,
          operation: 'delete',
        }, error)
      )
    });
}
