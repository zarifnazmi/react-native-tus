package com.margelo.nitro.tus
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class Tus : HybridTusSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
