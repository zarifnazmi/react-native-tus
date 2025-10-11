#include <jni.h>
#include "tusOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::tus::initialize(vm);
}
