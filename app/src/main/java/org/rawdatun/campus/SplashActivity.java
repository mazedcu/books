package org.rawdatun.campus;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.AnimationSet;
import android.view.animation.ScaleAnimation;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        ImageView logo = findViewById(R.id.splashLogo);
        TextView title = findViewById(R.id.splashTitle);
        TextView subtitle = findViewById(R.id.splashSubtitle);

        // Logo animation: scale + fade in
        AnimationSet logoAnim = new AnimationSet(true);
        ScaleAnimation scale = new ScaleAnimation(0.5f, 1f, 0.5f, 1f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f);
        scale.setDuration(700);
        AlphaAnimation fadeIn = new AlphaAnimation(0f, 1f);
        fadeIn.setDuration(700);
        logoAnim.addAnimation(scale);
        logoAnim.addAnimation(fadeIn);
        logoAnim.setFillAfter(true);
        logo.startAnimation(logoAnim);

        // Title fade in (delayed)
        AlphaAnimation titleAnim = new AlphaAnimation(0f, 1f);
        titleAnim.setStartOffset(500);
        titleAnim.setDuration(600);
        titleAnim.setFillAfter(true);
        title.startAnimation(titleAnim);

        // Subtitle fade in (more delayed)
        AlphaAnimation subtitleAnim = new AlphaAnimation(0f, 1f);
        subtitleAnim.setStartOffset(900);
        subtitleAnim.setDuration(600);
        subtitleAnim.setFillAfter(true);
        subtitle.startAnimation(subtitleAnim);

        // Navigate to MainActivity after 2.2s
        new Handler().postDelayed(() -> {
            Intent intent = new Intent(SplashActivity.this, MainActivity.class);
            startActivity(intent);
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }, 2200);
    }
}
